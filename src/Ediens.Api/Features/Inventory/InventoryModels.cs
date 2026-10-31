using System.Text.Json.Serialization;

namespace Ediens.Api.Features.Inventory;

public record CreateInventoryItemRequest(
    [property: JsonPropertyName("householdId")] Guid HouseholdId,
    [property: JsonPropertyName("productId")] Guid? ProductId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("location")] string Location,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("expiresAt")] DateTime ExpiresAt,
    [property: JsonPropertyName("openedAt")] DateTime? OpenedAt = null
);

public record UpdateInventoryItemQuantityRequest(
    [property: JsonPropertyName("quantityDelta")] decimal QuantityDelta,
    [property: JsonPropertyName("markOpened")] bool MarkOpened = false
);

public record InventoryItemResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("householdId")] Guid HouseholdId,
    [property: JsonPropertyName("productId")] Guid? ProductId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("location")] string Location,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("expiresAt")] DateTime ExpiresAt,
    [property: JsonPropertyName("openedAt")] DateTime? OpenedAt,
    [property: JsonPropertyName("etag")] string Etag,
    [property: JsonPropertyName("freshnessStatus")] string FreshnessStatus,
    [property: JsonPropertyName("daysUntilExpiration")] int DaysUntilExpiration,
    [property: JsonPropertyName("createdAt")] DateTime CreatedAt
);

public record InventoryItemListResponse(
    [property: JsonPropertyName("householdId")] Guid HouseholdId,
    [property: JsonPropertyName("totalCount")] int TotalCount,
    [property: JsonPropertyName("items")] List<InventoryItemResponse> Items
);
