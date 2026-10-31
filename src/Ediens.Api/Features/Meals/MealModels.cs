using System.Text.Json.Serialization;

namespace Ediens.Api.Features.Meals;

public record MealLogItemInput(
    [property: JsonPropertyName("productId")] Guid? ProductId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit
);

public record CreateMealLogRequest(
    [property: JsonPropertyName("mealType")] string MealType,
    [property: JsonPropertyName("loggedAt")] DateTime LoggedAt,
    [property: JsonPropertyName("items")] List<MealLogItemInput> Items
);

public record MacroBudgetValues(
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs
);

public record MealLogResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("userId")] Guid UserId,
    [property: JsonPropertyName("mealType")] string MealType,
    [property: JsonPropertyName("loggedAt")] DateTime LoggedAt,
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs,
    [property: JsonPropertyName("itemsCount")] int ItemsCount,
    [property: JsonPropertyName("remainingBudgetToday")] MacroBudgetValues RemainingBudgetToday
);

public record MealLogItemDto(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("productId")] Guid? ProductId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs
);

public record MealLogDetailDto(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("userId")] Guid UserId,
    [property: JsonPropertyName("mealType")] string MealType,
    [property: JsonPropertyName("loggedAt")] DateTime LoggedAt,
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs,
    [property: JsonPropertyName("idempotencyKey")] Guid? IdempotencyKey,
    [property: JsonPropertyName("items")] List<MealLogItemDto> Items
);

public record MealLogListResponse(
    [property: JsonPropertyName("meals")] List<MealLogDetailDto> Meals
);
