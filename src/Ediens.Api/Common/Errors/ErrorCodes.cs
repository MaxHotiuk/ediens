namespace Ediens.Api.Common.Errors;

/// <summary>
/// Типізовані доменні коди помилок платформи ēdiens за стандартом RFC 9457.
/// </summary>
public static class ErrorCodes
{
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string UnauthorizedAccess = "UNAUTHORIZED_ACCESS";
    public const string HouseholdAccessDenied = "HOUSEHOLD_ACCESS_DENIED";
    public const string ItemNotFound = "ITEM_NOT_FOUND";
    public const string ConcurrentModification = "CONCURRENT_MODIFICATION";
    public const string IdempotencyConflict = "IDEMPOTENCY_CONFLICT";
    public const string InsufficientInventory = "INSUFFICIENT_INVENTORY";
    public const string RateLimitExceeded = "RATE_LIMIT_EXCEEDED";
    public const string InternalServerError = "INTERNAL_SERVER_ERROR";
    public const string ExternalServiceUnavailable = "EXTERNAL_SERVICE_UNAVAILABLE";
}
