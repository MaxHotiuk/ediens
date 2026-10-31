using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Ediens.Api.Middleware;

/// <summary>
/// Налаштування генератора Swagger / OpenAPI 3.1 із підтримкою JWT Bearer, Idempotency-Key та If-Match.
/// </summary>
public static class SwaggerExtensions
{
    public static IServiceCollection AddEdiensOpenApi(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "ēdiens API",
                Version = "v1",
                Description = "ēdiens — єдиний хаб для управління запасами продуктів, підрахунку макросів та рекомендацій рецептів. Відповідає стандартам OpenAPI 3.1 та RFC 9457.",
                Contact = new OpenApiContact
                {
                    Name = "ēdiens Engineering Team",
                    Email = "support@ediens.app",
                    Url = new Uri("https://ediens.app")
                }
            });

            // Налаштування JWT Bearer авторизації у Swagger UI
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
                Name = "Authorization",
                In = ParameterLocation.Header,
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT"
            });

            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });

            c.OperationFilter<EdiensHeaderOperationFilter>();
        });

        return services;
    }
}

/// <summary>
/// Додає стандартні заголовки (Idempotency-Key, If-Match) до Swagger документації мутуючих ендпоінтів.
/// </summary>
public class EdiensHeaderOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        operation.Parameters ??= new List<OpenApiParameter>();

        var httpMethod = context.ApiDescription.HttpMethod?.ToUpperInvariant();
        if (httpMethod is "POST" or "PUT" or "PATCH")
        {
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = "Idempotency-Key",
                In = ParameterLocation.Header,
                Required = false,
                Description = "Унікальний UUIDv7 ключ клієнта для гарантії ідемпотентності мутуючого запиту.",
                Schema = new OpenApiSchema { Type = "string", Format = "uuid" }
            });
        }

        if (httpMethod is "PATCH" or "PUT")
        {
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = "If-Match",
                In = ParameterLocation.Header,
                Required = false,
                Description = "Поточний ETag (PostgreSQL xmin) для перевірки оптимістичного блокування. Приклад: W/\"10423\".",
                Schema = new OpenApiSchema { Type = "string" }
            });
        }
    }
}
