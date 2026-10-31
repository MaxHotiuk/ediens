using System.Text.Json.Serialization;
using Ediens.Api.Features.Meals;

namespace Ediens.Api.Features.Recipes;

public record RecipeRecommendationItem(
    [property: JsonPropertyName("recipeId")] Guid RecipeId,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("prepTimeMinutes")] int PrepTimeMinutes,
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs,
    [property: JsonPropertyName("matchScore")] decimal MatchScore,
    [property: JsonPropertyName("expiringIngredientsCount")] int ExpiringIngredientsCount,
    [property: JsonPropertyName("missingIngredientsCount")] int MissingIngredientsCount,
    [property: JsonPropertyName("canCookImmediately")] bool CanCookImmediately
);

public record RecipeRecommendationListResponse(
    [property: JsonPropertyName("householdId")] Guid HouseholdId,
    [property: JsonPropertyName("generatedAt")] DateTime GeneratedAt,
    [property: JsonPropertyName("recommendations")] List<RecipeRecommendationItem> Recommendations
);

public record CookRecipeRequest(
    [property: JsonPropertyName("householdId")] Guid HouseholdId,
    [property: JsonPropertyName("servings")] int Servings = 1,
    [property: JsonPropertyName("mealType")] string MealType = "Dinner"
);

public record CookedBatchDeduction(
    [property: JsonPropertyName("batchId")] Guid BatchId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("deductedQuantity")] decimal DeductedQuantity,
    [property: JsonPropertyName("remainingQuantity")] decimal RemainingQuantity,
    [property: JsonPropertyName("unit")] string Unit
);

public record CookRecipeResponse(
    [property: JsonPropertyName("recipeId")] Guid RecipeId,
    [property: JsonPropertyName("mealLogId")] Guid MealLogId,
    [property: JsonPropertyName("servingsCooked")] int ServingsCooked,
    [property: JsonPropertyName("deductedBatches")] List<CookedBatchDeduction> DeductedBatches,
    [property: JsonPropertyName("loggedMacros")] MacroBudgetValues LoggedMacros
);
