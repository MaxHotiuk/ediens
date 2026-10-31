using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace Ediens.Api.Common.Errors;

/// <summary>
/// Єдина фабрика генерації відповідей за стандартом RFC 9457 для .NET Minimal APIs.
/// </summary>
public static class EdiensResults
{
    public const string ProblemJsonContentType = "application/problem+json; charset=utf-8";

    public static IResult ProblemDetails(
        int statusCode,
        string title,
        string detail,
        string errorCode,
        string instance,
        object? extensions = null)
    {
        var traceId = Activity.Current?.Id ?? Guid.NewGuid().ToString();

        var problem = new EdiensProblemDetails
        {
            Type = $"https://ediens.app/errors/{errorCode.ToLowerInvariant().Replace('_', '-')}",
            Title = title,
            Status = statusCode,
            Detail = detail,
            Instance = instance,
            ErrorCode = errorCode,
            TraceId = traceId,
            Timestamp = DateTime.UtcNow.ToString("O")
        };

        if (extensions != null)
        {
            problem.Extensions = new Dictionary<string, object?>();
            if (extensions is IDictionary<string, object?> dict)
            {
                foreach (var (k, v) in dict)
                {
                    problem.Extensions[k] = v;
                }
            }
            else
            {
                foreach (var prop in extensions.GetType().GetProperties())
                {
                    var val = prop.GetValue(extensions);
                    var jsonPropName = char.ToLowerInvariant(prop.Name[0]) + prop.Name[1..];
                    problem.Extensions[jsonPropName] = val;
                }
            }
        }

        return Results.Json(problem, statusCode: statusCode, contentType: ProblemJsonContentType);
    }

    public static IResult ValidationProblem(
        string instance,
        string detail = "The request payload failed input validation rules. Please correct the specified fields.",
        Dictionary<string, string[]>? errors = null,
        List<InvalidParamItem>? invalidParams = null)
    {
        var ext = new Dictionary<string, object?>();
        if (errors != null) ext["errors"] = errors;
        if (invalidParams != null) ext["invalidParams"] = invalidParams;

        return ProblemDetails(
            StatusCodes.Status400BadRequest,
            "One or more validation errors occurred.",
            detail,
            ErrorCodes.ValidationFailed,
            instance,
            ext);
    }

    public static IResult Unauthorized(
        string instance,
        string detail = "Authentication token is missing, expired, or invalid.",
        DateTime? tokenExpiredAt = null,
        bool canRefresh = true)
    {
        var ext = new Dictionary<string, object?>
        {
            ["canRefresh"] = canRefresh
        };
        if (tokenExpiredAt.HasValue)
        {
            ext["tokenExpiredAt"] = tokenExpiredAt.Value.ToString("O");
        }

        return ProblemDetails(
            StatusCodes.Status401Unauthorized,
            "Authentication token is missing, expired, or invalid.",
            detail,
            ErrorCodes.UnauthorizedAccess,
            instance,
            ext);
    }

    public static IResult Forbidden(
        string instance,
        string detail,
        Guid? householdId = null,
        string? requiredRole = null)
    {
        var ext = new Dictionary<string, object?>();
        if (householdId.HasValue) ext["householdId"] = householdId.Value.ToString();
        if (!string.IsNullOrEmpty(requiredRole)) ext["requiredRole"] = requiredRole;

        return ProblemDetails(
            StatusCodes.Status403Forbidden,
            "Access to household resources denied.",
            detail,
            ErrorCodes.HouseholdAccessDenied,
            instance,
            ext);
    }

    public static IResult NotFound(
        string instance,
        string detail,
        string? resourceType = null,
        string? resourceId = null)
    {
        var ext = new Dictionary<string, object?>
        {
            ["searchedAtUtc"] = DateTime.UtcNow.ToString("O")
        };
        if (!string.IsNullOrEmpty(resourceType)) ext["resourceType"] = resourceType;
        if (!string.IsNullOrEmpty(resourceId)) ext["resourceId"] = resourceId;

        return ProblemDetails(
            StatusCodes.Status404NotFound,
            "Resource does not exist or was deleted.",
            detail,
            ErrorCodes.ItemNotFound,
            instance,
            ext);
    }

    public static IResult ConcurrentModification(
        string instance,
        string detail,
        string currentETag,
        decimal currentQuantity,
        string unit,
        string? clientExpectedETag = null,
        string? productName = null,
        string? lastModifiedBy = null,
        DateTime? lastModifiedAt = null)
    {
        var ext = new ConcurrentModificationExtensions
        {
            CurrentETag = currentETag,
            ClientExpectedETag = clientExpectedETag,
            CurrentQuantity = currentQuantity,
            Unit = unit,
            ProductName = productName,
            LastModifiedBy = lastModifiedBy,
            LastModifiedAt = lastModifiedAt ?? DateTime.UtcNow
        };

        return ProblemDetails(
            StatusCodes.Status409Conflict,
            "Conflict during state modification",
            detail,
            ErrorCodes.ConcurrentModification,
            instance,
            ext);
    }

    public static IResult IdempotencyConflict(
        string instance,
        string idempotencyKey,
        int lockExpiresInMs = 2500)
    {
        var ext = new Dictionary<string, object?>
        {
            ["idempotencyKey"] = idempotencyKey,
            ["state"] = "IN_FLIGHT",
            ["lockExpiresInMs"] = lockExpiresInMs
        };

        return ProblemDetails(
            StatusCodes.Status409Conflict,
            "Concurrent idempotent request already in progress.",
            $"An identical request with Idempotency-Key '{idempotencyKey}' is currently being processed by the server. Please do not retry immediately.",
            ErrorCodes.IdempotencyConflict,
            instance,
            ext);
    }

    public static IResult InsufficientInventory(
        string instance,
        string detail,
        Guid recipeId,
        int requestedServings,
        List<MissingIngredientItem> missingIngredients)
    {
        var ext = new InsufficientInventoryExtensions
        {
            RecipeId = recipeId,
            RequestedServings = requestedServings,
            MissingIngredients = missingIngredients
        };

        return ProblemDetails(
            StatusCodes.Status422UnprocessableEntity,
            "Inventory stock insufficient to complete requested action.",
            detail,
            ErrorCodes.InsufficientInventory,
            instance,
            ext);
    }

    public static IResult RateLimitExceeded(
        string instance,
        int retryAfterSeconds,
        int limit = 60,
        int windowSeconds = 60,
        string scope = "Default")
    {
        var ext = new RateLimitExtensions
        {
            RetryAfterSeconds = retryAfterSeconds,
            Limit = limit,
            WindowSeconds = windowSeconds,
            RateLimitScope = scope
        };

        return ProblemDetails(
            StatusCodes.Status429TooManyRequests,
            "Too Many Requests",
            $"Rate limit quota exceeded. Please wait {retryAfterSeconds} seconds before sending further requests.",
            ErrorCodes.RateLimitExceeded,
            instance,
            ext);
    }

    public static IResult InternalServerError(
        string instance,
        string detail = "A critical system error occurred while processing your request. Our engineering team has been notified. Use the provided traceId when contacting support.",
        string supportContact = "support@ediens.app")
    {
        var ext = new Dictionary<string, object?>
        {
            ["supportContact"] = supportContact
        };

        return ProblemDetails(
            StatusCodes.Status500InternalServerError,
            "An unexpected error occurred on the server.",
            detail,
            ErrorCodes.InternalServerError,
            instance,
            ext);
    }
}
