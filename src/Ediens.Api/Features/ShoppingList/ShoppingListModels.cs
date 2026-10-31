using System.Text.Json.Serialization;

namespace Ediens.Api.Features.ShoppingList;

public record ShoppingListClientChange(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("isPurchased")] bool IsPurchased,
    [property: JsonPropertyName("clientUpdatedAt")] DateTime ClientUpdatedAt
);

public record ShoppingListSyncRequest(
    [property: JsonPropertyName("lastSyncTimestamp")] DateTime LastSyncTimestamp,
    [property: JsonPropertyName("clientChanges")] List<ShoppingListClientChange> ClientChanges
);

public record ShoppingListItemResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("isPurchased")] bool IsPurchased,
    [property: JsonPropertyName("updatedAt")] DateTime UpdatedAt
);

public record ShoppingListSyncResponse(
    [property: JsonPropertyName("householdId")] Guid HouseholdId,
    [property: JsonPropertyName("serverTimestamp")] DateTime ServerTimestamp,
    [property: JsonPropertyName("items")] List<ShoppingListItemResponse> Items
);
