using System.Net;
using System.Threading.RateLimiting;
using Ediens.Api.Common.Errors;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Ediens.Api.Middleware;

/// <summary>
/// Налаштування ASP.NET Core SlidingWindowRateLimiter з формуванням RFC 9457 відповідей.
/// </summary>
public static class RateLimiterExtensions
{
    public const string SlidingPolicyName = "sliding";
    public const string BarcodePolicyName = "barcode";

    public static IServiceCollection AddEdiensRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Загальна політика ковзного вікна (60 запитів на 60 секунд)
            options.AddSlidingWindowLimiter(SlidingPolicyName, opt =>
            {
                opt.PermitLimit = 60;
                opt.Window = TimeSpan.FromSeconds(60);
                opt.SegmentsPerWindow = 6;
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                opt.QueueLimit = 0;
            });

            // Спеціальна політика для сканування штрих-кодів (30 запитів на хвилину)
            options.AddSlidingWindowLimiter(BarcodePolicyName, opt =>
            {
                opt.PermitLimit = 30;
                opt.Window = TimeSpan.FromSeconds(60);
                opt.SegmentsPerWindow = 6;
                opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                opt.QueueLimit = 0;
            });

            // Кастомний обробник відхилення запиту з поверненням RFC 9457 ProblemDetails
            options.OnRejected = async (context, cancellationToken) =>
            {
                int retryAfterSeconds = 30;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfterSpan))
                {
                    retryAfterSeconds = (int)Math.Max(1, retryAfterSpan.TotalSeconds);
                }

                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();
                context.HttpContext.Response.Headers["X-RateLimit-Limit"] = "60";
                context.HttpContext.Response.Headers["X-RateLimit-Remaining"] = "0";
                context.HttpContext.Response.Headers["X-RateLimit-Reset"] = retryAfterSeconds.ToString();

                var problem = EdiensResults.RateLimitExceeded(
                    context.HttpContext.Request.Path,
                    retryAfterSeconds,
                    limit: 60,
                    windowSeconds: 60,
                    scope: "SlidingWindowRateLimiter");

                await problem.ExecuteAsync(context.HttpContext);
            };
        });

        return services;
    }
}
