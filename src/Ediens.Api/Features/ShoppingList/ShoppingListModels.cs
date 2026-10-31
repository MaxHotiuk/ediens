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

public record TransferShoppingListItemRequest(
    [property: JsonPropertyName("itemId")] Guid ItemId,
    [property: JsonPropertyName("location")] string? Location = null,
    [property: JsonPropertyName("expiresAt")] DateTime? ExpiresAt = null,
    [property: JsonPropertyName("quantity")] decimal? Quantity = null,
    [property: JsonPropertyName("unit")] string? Unit = null
);

public record TransferShoppingListToInventoryRequest(
    [property: JsonPropertyName("items")] List<TransferShoppingListItemRequest>? Items = null
);

public record TransferredInventoryItemSummary(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("productId")] Guid ProductId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("location")] string Location,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("expiresAt")] DateTime ExpiresAt
);

public record TransferShoppingListResponse(
    [property: JsonPropertyName("transferredCount")] int TransferredCount,
    [property: JsonPropertyName("transferredItems")] List<TransferredInventoryItemSummary> TransferredItems,
    [property: JsonPropertyName("message")] string Message
);

public static class ProductSmartClassifier
{
    public record SmartDefaults(string Location, int ShelfLifeDays);

    public static SmartDefaults GetDefaults(string productName)
    {
        var name = (productName ?? string.Empty).ToLowerInvariant();

        // 1. Frozen / Морозилка -> Freezer +180 days
        if (name.Contains("заморож") || name.Contains("frozen") || name.Contains("freezer") ||
            name.Contains("морозив") || name.Contains("пельмен") || name.Contains("вареник") ||
            name.Contains("лід") || name.Contains("напівфабрикат"))
        {
            return new SmartDefaults("Freezer", 180);
        }

        // 2. Meat, Poultry, Fish, Seafood -> Fridge +4 days
        if (name.Contains("м'яс") || name.Contains("мяс") || name.Contains("куряч") || name.Contains("курк") ||
            name.Contains("філе") || name.Contains("свинин") || name.Contains("яловичин") || name.Contains("фарш") ||
            name.Contains("стейк") || name.Contains("ковбас") || name.Contains("сосиск") || name.Contains("шинк") ||
            name.Contains("риба") || name.Contains("рибн") || name.Contains("лосось") || name.Contains("тунець") ||
            name.Contains("хек") || name.Contains("креветк") || name.Contains("бекон") || name.Contains("meat") ||
            name.Contains("chicken") || name.Contains("beef") || name.Contains("pork") || name.Contains("fish") ||
            name.Contains("salmon") || name.Contains("tuna") || name.Contains("steak") || name.Contains("bacon"))
        {
            return new SmartDefaults("Fridge", 4);
        }

        // 3. Dairy, Cheese, Milk, Eggs -> Fridge +4 days
        if (name.Contains("молок") || name.Contains("сир") || name.Contains("творог") || name.Contains("кефір") ||
            name.Contains("йогурт") || name.Contains("сметан") || name.Contains("масло") || name.Contains("вершк") ||
            name.Contains("ряжанк") || name.Contains("яйц") || name.Contains("milk") || name.Contains("cheese") ||
            name.Contains("yogurt") || name.Contains("butter") || name.Contains("cream") || name.Contains("dairy") ||
            name.Contains("egg"))
        {
            return new SmartDefaults("Fridge", 4);
        }

        // 4. Fresh fruits, vegetables, salad, greens -> Fridge +7 days
        if (name.Contains("яблук") || name.Contains("банан") || name.Contains("огірок") || name.Contains("помідор") ||
            name.Contains("томат") || name.Contains("салат") || name.Contains("зелень") || name.Contains("шпинат") ||
            name.Contains("моркв") || name.Contains("капуст") || name.Contains("апельсин") || name.Contains("лимон") ||
            name.Contains("ягід") || name.Contains("полуниц") || name.Contains("чорниц") || name.Contains("авокадо") ||
            name.Contains("fruit") || name.Contains("vegetable") || name.Contains("tomato") || name.Contains("cucumber") ||
            name.Contains("apple") || name.Contains("banana") || name.Contains("berry") || name.Contains("salad") ||
            name.Contains("greens") || name.Contains("spinach"))
        {
            return new SmartDefaults("Fridge", 7);
        }

        // 5. Grains, Canned, Pasta, Bread, Oil, Dry goods -> Pantry +90 days
        if (name.Contains("круп") || name.Contains("рис") || name.Contains("гречк") || name.Contains("вівсян") ||
            name.Contains("борошн") || name.Contains("макарон") || name.Contains("паста") || name.Contains("спагет") ||
            name.Contains("консерв") || name.Contains("тушонк") || name.Contains("горох") || name.Contains("квасол") ||
            name.Contains("кукурудз") || name.Contains("олія") || name.Contains("цукор") || name.Contains("сіль") ||
            name.Contains("перець") || name.Contains("спеці") || name.Contains("хліб") || name.Contains("батон") ||
            name.Contains("печив") || name.Contains("чай") || name.Contains("кава") || name.Contains("соус") ||
            name.Contains("кетчуп") || name.Contains("майонез") || name.Contains("шоколад") || name.Contains("горіх") ||
            name.Contains("цибул") || name.Contains("часник") || name.Contains("картоп") ||
            name.Contains("grain") || name.Contains("rice") || name.Contains("pasta") || name.Contains("canned") ||
            name.Contains("flour") || name.Contains("oil") || name.Contains("sugar") || name.Contains("bread") ||
            name.Contains("coffee") || name.Contains("tea") || name.Contains("oats") || name.Contains("cereal") ||
            name.Contains("nuts") || name.Contains("beans"))
        {
            return new SmartDefaults("Pantry", 90);
        }

        // Default fallback
        return new SmartDefaults("Fridge", 4);
    }
}

