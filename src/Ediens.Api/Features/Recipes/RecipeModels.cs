using System.Text.Json.Serialization;
using Ediens.Api.Features.Meals;

namespace Ediens.Api.Features.Recipes;

public record RecipeIngredientDto(
    [property: JsonPropertyName("productId")] Guid ProductId,
    [property: JsonPropertyName("productName")] string ProductName,
    [property: JsonPropertyName("quantity")] decimal Quantity,
    [property: JsonPropertyName("unit")] string Unit,
    [property: JsonPropertyName("isAvailable")] bool IsAvailable
);

public record RecipeRecommendationItem(
    [property: JsonPropertyName("recipeId")] Guid RecipeId,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("instructions")] string Instructions,
    [property: JsonPropertyName("prepTimeMinutes")] int PrepTimeMinutes,
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs,
    [property: JsonPropertyName("matchScore")] decimal MatchScore,
    [property: JsonPropertyName("expiringIngredientsCount")] int ExpiringIngredientsCount,
    [property: JsonPropertyName("missingIngredientsCount")] int MissingIngredientsCount,
    [property: JsonPropertyName("canCookImmediately")] bool CanCookImmediately,
    [property: JsonPropertyName("ingredients")] List<RecipeIngredientDto> Ingredients
)
{
    [JsonPropertyName("id")]
    public Guid Id => RecipeId;

    [JsonPropertyName("totalCalories")]
    public decimal TotalCalories => Calories;

    [JsonPropertyName("totalProtein")]
    public decimal TotalProtein => Protein;

    [JsonPropertyName("totalFat")]
    public decimal TotalFat => Fat;

    [JsonPropertyName("totalCarbs")]
    public decimal TotalCarbs => Carbs;

    [JsonPropertyName("expiringStockMatchScore")]
    public decimal ExpiringStockMatchScore => MatchScore;
}

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
