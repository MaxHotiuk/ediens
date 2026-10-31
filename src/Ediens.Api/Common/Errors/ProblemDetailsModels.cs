using System.Text.Json.Serialization;

namespace Ediens.Api.Common.Errors;

/// <summary>
/// Специфікація схеми RFC 9457 у системі ēdiens з підтримкою обов'язкових розширень errorCode, traceId, timestamp.
/// </summary>
public class EdiensProblemDetails
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public int Status { get; set; }

    [JsonPropertyName("detail")]
    public string Detail { get; set; } = string.Empty;

    [JsonPropertyName("instance")]
    public string Instance { get; set; } = string.Empty;

    [JsonPropertyName("errorCode")]
    public string ErrorCode { get; set; } = string.Empty;

    [JsonPropertyName("traceId")]
    public string TraceId { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("O");

    [JsonPropertyName("extensions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, object?>? Extensions { get; set; }
}

public class ConcurrentModificationExtensions
{
    [JsonPropertyName("currentETag")]
    public string CurrentETag { get; set; } = string.Empty;

    [JsonPropertyName("clientExpectedETag")]
    public string? ClientExpectedETag { get; set; }

    [JsonPropertyName("currentQuantity")]
    public decimal CurrentQuantity { get; set; }

    [JsonPropertyName("unit")]
    public string Unit { get; set; } = string.Empty;

    [JsonPropertyName("productName")]
    public string? ProductName { get; set; }

    [JsonPropertyName("lastModifiedBy")]
    public string? LastModifiedBy { get; set; }

    [JsonPropertyName("lastModifiedAt")]
    public DateTime? LastModifiedAt { get; set; }
}

public class InsufficientInventoryExtensions
{
    [JsonPropertyName("recipeId")]
    public Guid RecipeId { get; set; }

    [JsonPropertyName("requestedServings")]
    public int RequestedServings { get; set; }

    [JsonPropertyName("missingIngredients")]
    public List<MissingIngredientItem> MissingIngredients { get; set; } = new();
}

public class MissingIngredientItem
{
    [JsonPropertyName("productId")]
    public Guid ProductId { get; set; }

    [JsonPropertyName("productName")]
    public string ProductName { get; set; } = string.Empty;

    [JsonPropertyName("requiredQuantity")]
    public decimal RequiredQuantity { get; set; }

    [JsonPropertyName("availableQuantity")]
    public decimal AvailableQuantity { get; set; }

    [JsonPropertyName("unit")]
    public string Unit { get; set; } = string.Empty;

    [JsonPropertyName("shortfall")]
    public decimal Shortfall { get; set; }
}

public class RateLimitExtensions
{
    [JsonPropertyName("retryAfterSeconds")]
    public int RetryAfterSeconds { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }

    [JsonPropertyName("windowSeconds")]
    public int WindowSeconds { get; set; }

    [JsonPropertyName("rateLimitScope")]
    public string RateLimitScope { get; set; } = string.Empty;
}

public class ValidationExtensions
{
    [JsonPropertyName("errors")]
    public Dictionary<string, string[]>? Errors { get; set; }

    [JsonPropertyName("invalidParams")]
    public List<InvalidParamItem>? InvalidParams { get; set; }
}

public class InvalidParamItem
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("reason")]
    public string Reason { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public object? Value { get; set; }
}
