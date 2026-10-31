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

// 3. Реєстрація RFC 9457 ProblemDetails та Rate Limiter
builder.Services.AddProblemDetails();
builder.Services.AddEdiensRateLimiting();

// 4. Реєстрація OpenAPI 3.1 / Swagger
builder.Services.AddEdiensOpenApi();

var app = builder.Build();

// 5. Middleware Pipeline
// Першим реєструється глобальний перехоплювач винятків RFC 9457
app.UseMiddleware<EdiensExceptionHandlerMiddleware>();

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

app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    timestamp = DateTime.UtcNow,
    service = "Ediens.Api",
    version = "1.0.0"
}))
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

// 7. Реєстрація всіх вертикальних слайсів та REST-ендпоінтів платформи ēdiens
app.MapEdiensEndpoints();

// Автоматичне створення схеми та демо-сідінг при наявності зв'язку з БД
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<EdiensDbContext>();
    if (db.Database.CanConnect())
    {
        await db.Database.EnsureCreatedAsync();
        await Ediens.Api.Features.Common.DatabaseSeeder.SeedAsync(db);
        app.Logger.LogInformation("База даних PostgreSQL успішно ініціалізована та заповнена базовими даними.");
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Помилка автоматичної ініціалізації бази даних. Можливо, сервіс БД недоступний.");
}

app.Run();

// Робимо клас доступним для тестів WebApplicationFactory
public partial class Program { }
