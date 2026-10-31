namespace Ediens.Api.Common.Errors;

public abstract class EdiensException : Exception
{
    public int StatusCode { get; }
    public string ErrorCode { get; }
    public object? Extensions { get; }

    protected EdiensException(int statusCode, string errorCode, string message, object? extensions = null, Exception? innerException = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
        Extensions = extensions;
    }
}

public class ValidationException : EdiensException
{
    public ValidationException(string message, Dictionary<string, string[]>? errors = null, List<InvalidParamItem>? invalidParams = null)
        : base(400, ErrorCodes.ValidationFailed, message, new ValidationExtensions { Errors = errors, InvalidParams = invalidParams })
    {
    }
}

public class UnauthorizedException : EdiensException
{
    public UnauthorizedException(string message = "Authentication token is missing, expired, or invalid.", DateTime? tokenExpiredAt = null)
        : base(401, ErrorCodes.UnauthorizedAccess, message, new { tokenExpiredAt = tokenExpiredAt?.ToString("O"), canRefresh = true })
    {
    }
}

public class HouseholdAccessDeniedException : EdiensException
{
    public HouseholdAccessDeniedException(Guid householdId, string detail = "Access to household resources denied.", string requiredRole = "Member")
        : base(403, ErrorCodes.HouseholdAccessDenied, detail, new { householdId = householdId.ToString(), requiredRole, currentMembershipStatus = "NOT_A_MEMBER" })
    {
    }
}

public class ItemNotFoundException : EdiensException
{
    public ItemNotFoundException(string resourceType, string resourceId, string? detail = null)
        : base(404, ErrorCodes.ItemNotFound, detail ?? $"{resourceType} '{resourceId}' could not be found.", new { resourceType, resourceId, searchedAtUtc = DateTime.UtcNow.ToString("O") })
    {
    }
}

public class ConcurrentModificationException : EdiensException
{
    public ConcurrentModificationException(
        string message,
        string currentETag,
        decimal currentQuantity,
        string unit,
        string? clientExpectedETag = null,
        string? productName = null,
        string? lastModifiedBy = null)
        : base(409, ErrorCodes.ConcurrentModification, message, new ConcurrentModificationExtensions
        {
            CurrentETag = currentETag,
            ClientExpectedETag = clientExpectedETag,
            CurrentQuantity = currentQuantity,
            Unit = unit,
            ProductName = productName,
            LastModifiedBy = lastModifiedBy,
            LastModifiedAt = DateTime.UtcNow
        })
    {
    }
}

public class IdempotencyConflictException : EdiensException
{
    public IdempotencyConflictException(string idempotencyKey, int lockExpiresInMs = 2500)
        : base(409, ErrorCodes.IdempotencyConflict, $"An identical request with Idempotency-Key '{idempotencyKey}' is currently being processed by the server.", new { idempotencyKey, state = "IN_FLIGHT", lockExpiresInMs })
    {
    }
}

public class InsufficientInventoryException : EdiensException
{
    public InsufficientInventoryException(Guid recipeId, int requestedServings, List<MissingIngredientItem> missingIngredients, string? detail = null)
        : base(422, ErrorCodes.InsufficientInventory, detail ?? "Inventory stock insufficient to complete requested action.", new InsufficientInventoryExtensions
        {
            RecipeId = recipeId,
            RequestedServings = requestedServings,
            MissingIngredients = missingIngredients
        })
    {
    }
}

public class RateLimitExceededException : EdiensException
{
    public RateLimitExceededException(int retryAfterSeconds, string scope = "Default")
        : base(429, ErrorCodes.RateLimitExceeded, $"Rate limit quota exceeded. Please wait {retryAfterSeconds} seconds before sending further requests.", new RateLimitExtensions
        {
            RetryAfterSeconds = retryAfterSeconds,
            Limit = 60,
            WindowSeconds = 60,
            RateLimitScope = scope
        })
    {
    }
}
