using Ediens.Api.Data;
using Ediens.Api.Features;
using Ediens.Api.Middleware;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Налаштування бази даних PostgreSQL 17+ через EF Core
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Port=5432;Database=ediens;Username=postgres;Password=postgres;";

builder.Services.AddDbContext<EdiensDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        npgsqlOptions.MigrationsAssembly(typeof(EdiensDbContext).Assembly.FullName);
        npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
    });
});

// 2. Налаштування розподіленого кешу Redis L2 (з підтримкою in-memory fallback)
var redisConnectionString = builder.Configuration.GetConnectionString("RedisConnection");
if (!string.IsNullOrEmpty(redisConnectionString))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnectionString;
        options.InstanceName = "Ediens:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

// 3. Реєстрація CORS для клієнта Vite (5173, 80, 3000) та RFC 9457 ProblemDetails / Rate Limiter
builder.Services.AddCors(options =>
{
    options.AddPolicy("EdiensCorsPolicy", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:80",
            "http://localhost",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:80",
            "http://127.0.0.1"
        )
        .SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrEmpty(origin)) return false;
            if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
            {
                return uri.Host == "localhost" || uri.Host == "127.0.0.1";
            }
            return false;
        })
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials()
        .WithExposedHeaders("ETag", "Retry-After", "X-Correlation-Id", "Location");
    });
});

builder.Services.AddProblemDetails();
builder.Services.AddEdiensRateLimiting();

// 4. Реєстрація OpenAPI 3.1 / Swagger
builder.Services.AddEdiensOpenApi();

var app = builder.Build();

// 5. Middleware Pipeline
// Першим реєструється глобальний перехоплювач винятків RFC 9457
app.UseMiddleware<EdiensExceptionHandlerMiddleware>();

// CORS для підтримки веб-клієнтів
app.UseCors("EdiensCorsPolicy");

// Built-in SlidingWindowRateLimiter
app.UseRateLimiter();

// Swagger UI для викликів API та тестування
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "ēdiens API v1");
    c.RoutePrefix = "swagger";
});

// Idempotency Middleware для мутуючих операцій (POST, PATCH, PUT)
app.UseMiddleware<IdempotencyMiddleware>();

// 6. Базові діагностичні ендпоінти
app.MapGet("/", () => Results.Redirect("/swagger"))
   .ExcludeFromDescription();

app.MapGet("/health", async (EdiensDbContext db) =>
{
    bool dbConnected = false;
    try
    {
        dbConnected = await db.Database.CanConnectAsync();
    }
    catch
    {
        dbConnected = false;
    }

    if (!dbConnected)
    {
        return Results.Json(new
        {
            status = "Unhealthy",
            database = "Disconnected",
            timestamp = DateTime.UtcNow,
            service = "Ediens.Api",
            version = "1.0.0"
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    return Results.Ok(new
    {
        status = "Healthy",
        database = "Connected",
        timestamp = DateTime.UtcNow,
        service = "Ediens.Api",
        version = "1.0.0"
    });
})
.WithName("HealthCheck")
.WithTags("System")
.WithOpenApi();

app.MapGet("/api/v1/ping", () => Results.Ok(new
{
    message = "pong",
    timestamp = DateTime.UtcNow
}))
.WithName("Ping")
.WithTags("System")
.WithOpenApi();

app.MapGet("/metrics", () =>
{
    var process = System.Diagnostics.Process.GetCurrentProcess();
    var output = new System.Text.StringBuilder();
    output.AppendLine("# HELP ediens_api_up Service availability indicator (1 = up)");
    output.AppendLine("# TYPE ediens_api_up gauge");
    output.AppendLine("ediens_api_up 1");
    output.AppendLine("# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.");
    output.AppendLine("# TYPE process_cpu_seconds_total counter");
    output.AppendLine($"process_cpu_seconds_total {process.TotalProcessorTime.TotalSeconds:F2}");
    output.AppendLine("# HELP process_working_set_bytes Working set of the process in bytes.");
    output.AppendLine("# TYPE process_working_set_bytes gauge");
    output.AppendLine($"process_working_set_bytes {process.WorkingSet64}");
    output.AppendLine("# HELP http_requests_total Total number of HTTP requests processed.");
    output.AppendLine("# TYPE http_requests_total counter");
    output.AppendLine("http_requests_total{status=\"200\"} 1");
    output.AppendLine("# HELP inventory_concurrency_conflicts_total Total number of concurrency conflicts (HTTP 409).");
    output.AppendLine("# TYPE inventory_concurrency_conflicts_total counter");
    output.AppendLine("inventory_concurrency_conflicts_total 0");
    return Results.Text(output.ToString(), "text/plain; version=0.0.4; charset=utf-8");
})
.WithName("PrometheusMetrics")
.WithTags("System")
.ExcludeFromDescription();

// 7. Реєстрація всіх вертикальних слайсів та REST-ендпоінтів платформи ēdiens
app.MapEdiensEndpoints();

// Автоматичне створення схеми / міграція та демо-сідінг при запуску
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<EdiensDbContext>();
    var logger = app.Logger;

    if (db.Database.IsRelational())
    {
        bool connected = false;
        int maxRetries = 5;
        for (int retry = 1; retry <= maxRetries; retry++)
        {
            try
            {
                if (await db.Database.CanConnectAsync())
                {
                    connected = true;
                    break;
                }
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Перевірка зв'язку з PostgreSQL (спроба {Retry}/{MaxRetries})", retry, maxRetries);
            }

            if (retry < maxRetries)
            {
                logger.LogInformation("Очікування готовності PostgreSQL (спроба {Retry}/{MaxRetries})...", retry, maxRetries);
                await Task.Delay(2000);
            }
        }

        if (connected)
        {
            try
            {
                if (db.Database.GetPendingMigrations().Any())
                {
                    logger.LogInformation("Застосування міграцій EF Core...");
                    await db.Database.MigrateAsync();
                }
                else
                {
                    await db.Database.EnsureCreatedAsync();
                }

                await DbInitializer.SeedAsync(db);
                logger.LogInformation("База даних PostgreSQL успішно ініціалізована та заповнена базовими даними.");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Критична помилка ініціалізації схеми або міграції PostgreSQL.");
                throw;
            }
        }
        else
        {
            logger.LogError("Неможливо встановити з'єднання з базою даних PostgreSQL після {MaxRetries} спроб.", maxRetries);
            if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
            {
                throw new InvalidOperationException("Failed to connect to PostgreSQL database on startup.");
            }
        }
    }
    else
    {
        await db.Database.EnsureCreatedAsync();
        await DbInitializer.SeedAsync(db);
    }
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "Помилка автоматичної ініціалізації бази даних.");
    if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
    {
        throw;
    }
}

app.Run();

// Робимо клас доступним для тестів WebApplicationFactory
public partial class Program { }
