using System.Diagnostics;
using System.Text.Json;
using Ediens.Api.Common.Errors;
using Ediens.Api.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ediens.Api.Middleware;

/// <summary>
/// Глобальний Middleware для перехоплення винятків та форматування RFC 9457 ProblemDetails.
/// </summary>
public class EdiensExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<EdiensExceptionHandlerMiddleware> _logger;

    public EdiensExceptionHandlerMiddleware(RequestDelegate next, ILogger<EdiensExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);

            if (!context.Response.HasStarted)
            {
                if (context.Response.StatusCode == StatusCodes.Status404NotFound)
                {
                    var notFoundProblem = new EdiensProblemDetails
                    {
                        Type = "https://ediens.app/errors/item-not-found",
                        Title = "Resource does not exist or was deleted.",
                        Status = StatusCodes.Status404NotFound,
                        Detail = $"The requested endpoint or resource '{context.Request.Path}' was not found.",
                        Instance = context.Request.Path,
                        ErrorCode = ErrorCodes.ItemNotFound,
                        TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
                        Timestamp = DateTime.UtcNow.ToString("O")
                    };
                    await WriteProblemResponseAsync(context, StatusCodes.Status404NotFound, notFoundProblem);
                }
                else if (context.Response.StatusCode == StatusCodes.Status405MethodNotAllowed)
                {
                    var methodProblem = new EdiensProblemDetails
                    {
                        Type = "https://ediens.app/errors/validation-failed",
                        Title = "HTTP Method Not Allowed",
                        Status = StatusCodes.Status405MethodNotAllowed,
                        Detail = $"HTTP {context.Request.Method} method is not allowed on '{context.Request.Path}'.",
                        Instance = context.Request.Path,
                        ErrorCode = ErrorCodes.ValidationFailed,
                        TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
                        Timestamp = DateTime.UtcNow.ToString("O")
                    };
                    await WriteProblemResponseAsync(context, StatusCodes.Status405MethodNotAllowed, methodProblem);
                }
            }
        }
        catch (DbUpdateConcurrencyException ex)
        {
            await HandleConcurrencyExceptionAsync(context, ex);
        }
        catch (EdiensException ex)
        {
            await HandleEdiensExceptionAsync(context, ex);
        }
        catch (BadHttpRequestException ex)
        {
            await HandleBadRequestExceptionAsync(context, ex);
        }
        catch (JsonException ex)
        {
            await HandleJsonExceptionAsync(context, ex);
        }
        catch (Exception ex)
        {
            await HandleGenericExceptionAsync(context, ex);
        }
    }

    private async Task HandleJsonExceptionAsync(HttpContext context, JsonException ex)
    {
        _logger.LogWarning(ex, "Malformed JSON payload at {Path}", context.Request.Path);

        var problem = new EdiensProblemDetails
        {
            Type = "https://ediens.app/errors/validation-failed",
            Title = "Bad Request - Invalid JSON Payload",
            Status = StatusCodes.Status400BadRequest,
            Detail = ex.Message,
            Instance = context.Request.Path,
            ErrorCode = ErrorCodes.ValidationFailed,
            TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
            Timestamp = DateTime.UtcNow.ToString("O")
        };

        await WriteProblemResponseAsync(context, StatusCodes.Status400BadRequest, problem);
    }

    private async Task HandleConcurrencyExceptionAsync(HttpContext context, DbUpdateConcurrencyException ex)
    {
        _logger.LogWarning(ex, "Concurrency conflict detected at {Path}", context.Request.Path);

        string currentETag = "W/\"0\"";
        decimal currentQuantity = 0;
        string unit = "g";
        string? clientExpectedETag = context.Request.Headers.IfMatch.FirstOrDefault();

        var entry = ex.Entries.FirstOrDefault();
        if (entry != null)
        {
            var databaseValues = await entry.GetDatabaseValuesAsync(context.RequestAborted);
            if (databaseValues == null)
            {
                // Ресурс уже видалений іншим процесом
                var notFoundProblem = new EdiensProblemDetails
                {
                    Type = "https://ediens.app/errors/item-not-found",
                    Title = "Resource does not exist or was deleted.",
                    Status = StatusCodes.Status404NotFound,
                    Detail = "The requested entity has been deleted by another household member.",
                    Instance = context.Request.Path,
                    ErrorCode = ErrorCodes.ItemNotFound,
                    TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
                    Timestamp = DateTime.UtcNow.ToString("O")
                };
                await WriteProblemResponseAsync(context, StatusCodes.Status404NotFound, notFoundProblem);
                return;
            }

            if (entry.Entity is InventoryItem)
            {
                currentQuantity = databaseValues.GetValue<decimal>(nameof(InventoryItem.Quantity));
                unit = databaseValues.GetValue<string>(nameof(InventoryItem.Unit)) ?? "g";
                var xminVal = databaseValues.GetValue<uint>(nameof(InventoryItem.Version));
                currentETag = ETagHelper.Format(xminVal);
            }
        }

        context.Response.Headers.ETag = currentETag;

        var extensions = new ConcurrentModificationExtensions
        {
            CurrentETag = currentETag,
            ClientExpectedETag = clientExpectedETag,
            CurrentQuantity = currentQuantity,
            Unit = unit,
            LastModifiedAt = DateTime.UtcNow
        };

        var problem = new EdiensProblemDetails
        {
            Type = "https://ediens.app/errors/concurrent-modification",
            Title = "Conflict during state modification",
            Status = StatusCodes.Status409Conflict,
            Detail = "The inventory item has been modified by another household member since you loaded it.",
            Instance = context.Request.Path,
            ErrorCode = ErrorCodes.ConcurrentModification,
            TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
            Timestamp = DateTime.UtcNow.ToString("O"),
            Extensions = ToDictionary(extensions)
        };

        await WriteProblemResponseAsync(context, StatusCodes.Status409Conflict, problem);
    }

    private async Task HandleEdiensExceptionAsync(HttpContext context, EdiensException ex)
    {
        _logger.LogInformation(ex, "Handled domain exception ({StatusCode} {ErrorCode}) at {Path}", ex.StatusCode, ex.ErrorCode, context.Request.Path);

        var problem = new EdiensProblemDetails
        {
            Type = $"https://ediens.app/errors/{ex.ErrorCode.ToLowerInvariant().Replace('_', '-')}",
            Title = GetTitleForStatusCode(ex.StatusCode),
            Status = ex.StatusCode,
            Detail = ex.Message,
            Instance = context.Request.Path,
            ErrorCode = ex.ErrorCode,
            TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
            Timestamp = DateTime.UtcNow.ToString("O"),
            Extensions = ex.Extensions != null ? ToDictionary(ex.Extensions) : null
        };

        await WriteProblemResponseAsync(context, ex.StatusCode, problem);
    }

    private async Task HandleBadRequestExceptionAsync(HttpContext context, BadHttpRequestException ex)
    {
        _logger.LogWarning(ex, "Bad HTTP request at {Path}", context.Request.Path);

        var problem = new EdiensProblemDetails
        {
            Type = "https://ediens.app/errors/validation-failed",
            Title = "Bad Request",
            Status = StatusCodes.Status400BadRequest,
            Detail = ex.Message,
            Instance = context.Request.Path,
            ErrorCode = ErrorCodes.ValidationFailed,
            TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
            Timestamp = DateTime.UtcNow.ToString("O")
        };

        await WriteProblemResponseAsync(context, StatusCodes.Status400BadRequest, problem);
    }

    private async Task HandleGenericExceptionAsync(HttpContext context, Exception ex)
    {
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;
        _logger.LogError(ex, "Unhandled system exception at {Path} (TraceId: {TraceId})", context.Request.Path, traceId);

        var problem = new EdiensProblemDetails
        {
            Type = "https://ediens.app/errors/internal-server-error",
            Title = "An unexpected error occurred on the server.",
            Status = StatusCodes.Status500InternalServerError,
            Detail = "A critical system error occurred while processing your request. Our engineering team has been notified. Use the provided traceId when contacting support.",
            Instance = context.Request.Path,
            ErrorCode = ErrorCodes.InternalServerError,
            TraceId = traceId,
            Timestamp = DateTime.UtcNow.ToString("O"),
            Extensions = new Dictionary<string, object?>
            {
                ["supportContact"] = "support@ediens.app"
            }
        };

        await WriteProblemResponseAsync(context, StatusCodes.Status500InternalServerError, problem);
    }

    private static async Task WriteProblemResponseAsync(HttpContext context, int statusCode, EdiensProblemDetails problem)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = EdiensResults.ProblemJsonContentType;

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        await JsonSerializer.SerializeAsync(context.Response.Body, problem, jsonOptions);
    }

    private static Dictionary<string, object?> ToDictionary(object obj)
    {
        if (obj is Dictionary<string, object?> dict) return dict;

        var result = new Dictionary<string, object?>();
        foreach (var prop in obj.GetType().GetProperties())
        {
            var val = prop.GetValue(obj);
            var jsonPropName = char.ToLowerInvariant(prop.Name[0]) + prop.Name[1..];
            result[jsonPropName] = val;
        }
        return result;
    }

    private static string GetTitleForStatusCode(int statusCode) => statusCode switch
    {
        400 => "One or more validation errors occurred.",
        401 => "Authentication token is missing, expired, or invalid.",
        403 => "Access to household resources denied.",
        404 => "Resource does not exist or was deleted.",
        409 => "Conflict during state modification.",
        422 => "Inventory stock insufficient to complete requested action.",
        429 => "Too Many Requests",
        _ => "An error occurred."
    };
}
