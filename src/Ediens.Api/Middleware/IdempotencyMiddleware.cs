using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Ediens.Api.Middleware;

/// <summary>
/// Middleware для гарантії ідемпотентності мутуючих операцій (Idempotency-Key).
/// Використовує розподілений кеш (Redis) та базу даних EF Core (idempotency_records).
/// </summary>
public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IdempotencyMiddleware> _logger;
    private static readonly ConcurrentDictionary<string, byte> InFlightRequests = new();

    public const string IdempotencyHeader = "Idempotency-Key";
    public const string ReplayedHeader = "X-Idempotency-Replayed";

    public IdempotencyMiddleware(RequestDelegate next, ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider)
    {
        // Перевіряємо наявність заголовка для мутуючих запитів
        if (!HttpMethods.IsPost(context.Request.Method) &&
            !HttpMethods.IsPatch(context.Request.Method) &&
            !HttpMethods.IsPut(context.Request.Method) &&
            !HttpMethods.IsDelete(context.Request.Method))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(IdempotencyHeader, out var headerValues) ||
            string.IsNullOrWhiteSpace(headerValues.FirstOrDefault()))
        {
            await _next(context);
            return;
        }

        var idempotencyKey = headerValues.First()!.Trim();
        if (idempotencyKey.Length > 64)
        {
            var problem = EdiensResults.ProblemDetails(
                StatusCodes.Status400BadRequest,
                "Bad Request",
                "Idempotency-Key length exceeds 64 characters.",
                ErrorCodes.ValidationFailed,
                context.Request.Path);
            await problem.ExecuteAsync(context);
            return;
        }

        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<EdiensDbContext>();
        var distributedCache = scope.ServiceProvider.GetService<IDistributedCache>();

        // 1. Перевірка кешу / БД на наявність вже виконаного запиту
        var cachedRecord = await FindExistingRecordAsync(dbContext, distributedCache, idempotencyKey);
        if (cachedRecord != null)
        {
            _logger.LogInformation("Returning idempotent cached response for key {Key}", idempotencyKey);
            context.Response.StatusCode = cachedRecord.StatusCode;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers[ReplayedHeader] = "true";
            await context.Response.WriteAsync(cachedRecord.ResponseBody, Encoding.UTF8);
            return;
        }

        // 2. Захист від гонитви (In-Flight Request Check)
        if (!InFlightRequests.TryAdd(idempotencyKey, 1))
        {
            _logger.LogWarning("Concurrent request with in-flight key {Key}", idempotencyKey);
            var conflictProblem = EdiensResults.IdempotencyConflict(context.Request.Path, idempotencyKey);
            await conflictProblem.ExecuteAsync(context);
            return;
        }

        var originalBodyStream = context.Response.Body;
        using var memoryStream = new MemoryStream();
        context.Response.Body = memoryStream;

        try
        {
            await _next(context);

            memoryStream.Position = 0;
            var responseBody = await new StreamReader(memoryStream).ReadToEndAsync();
            memoryStream.Position = 0;

            // Зберігаємо результат для успішних та доменних відповідей (2xx, 4xx)
            if (context.Response.StatusCode < 500)
            {
                var userId = GetUserIdFromClaims(context);

                var record = new IdempotencyRecord
                {
                    IdempotencyKey = idempotencyKey,
                    UserId = userId,
                    RequestPath = context.Request.Path,
                    StatusCode = context.Response.StatusCode,
                    ResponseBody = string.IsNullOrWhiteSpace(responseBody) ? "{}" : responseBody,
                    CreatedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddHours(24)
                };

                await SaveRecordAsync(dbContext, distributedCache, record);
            }

            await memoryStream.CopyToAsync(originalBodyStream);
        }
        finally
        {
            context.Response.Body = originalBodyStream;
            InFlightRequests.TryRemove(idempotencyKey, out _);
        }
    }

    private static async Task<IdempotencyRecord?> FindExistingRecordAsync(
        EdiensDbContext dbContext,
        IDistributedCache? distributedCache,
        string key)
    {
        // Спроба прочитати з L2 Redis кешу
        if (distributedCache != null)
        {
            try
            {
                var cachedJson = await distributedCache.GetStringAsync($"idempotency:{key}");
                if (!string.IsNullOrEmpty(cachedJson))
                {
                    return JsonSerializer.Deserialize<IdempotencyRecord>(cachedJson);
                }
            }
            catch
            {
                // Помилка Redis не блокує перевірку в БД
            }
        }

        // Читання з PostgreSQL
        return await dbContext.IdempotencyRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdempotencyKey == key && r.ExpiresAt > DateTime.UtcNow);
    }

    private static async Task SaveRecordAsync(
        EdiensDbContext dbContext,
        IDistributedCache? distributedCache,
        IdempotencyRecord record)
    {
        try
        {
            dbContext.IdempotencyRecords.Add(record);
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Ігноруємо дублювання первинного ключа при паралельному збереженні
        }

        if (distributedCache != null)
        {
            try
            {
                var json = JsonSerializer.Serialize(record);
                await distributedCache.SetStringAsync(
                    $"idempotency:{record.IdempotencyKey}",
                    json,
                    new DistributedCacheEntryOptions
                    {
                        AbsoluteExpiration = record.ExpiresAt
                    });
            }
            catch
            {
                // Не блокуємо відповідь клієнту при тимчасовому збої Redis
            }
        }
    }

    private static Guid GetUserIdFromClaims(HttpContext context)
    {
        var sub = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? context.User.FindFirst("sub")?.Value;

        return Guid.TryParse(sub, out var guid) ? guid : Guid.Parse("0192e2b0-0000-7000-8000-000000000001");
    }
}
