using System.Text.Json.Serialization;

namespace Ediens.Api.Features.Nutrition;

public record SetNutritionTargetsRequest(
    [property: JsonPropertyName("targetCalories")] decimal TargetCalories,
    [property: JsonPropertyName("targetProtein")] decimal TargetProtein,
    [property: JsonPropertyName("targetFat")] decimal TargetFat,
    [property: JsonPropertyName("targetCarbs")] decimal TargetCarbs,
    [property: JsonPropertyName("effectiveFrom")] string? EffectiveFrom = null
);

public record NutritionTargetsResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("userId")] Guid UserId,
    [property: JsonPropertyName("targetCalories")] decimal TargetCalories,
    [property: JsonPropertyName("targetProtein")] decimal TargetProtein,
    [property: JsonPropertyName("targetFat")] decimal TargetFat,
    [property: JsonPropertyName("targetCarbs")] decimal TargetCarbs,
    [property: JsonPropertyName("effectiveFrom")] string EffectiveFrom,
    [property: JsonPropertyName("updatedAt")] DateTime UpdatedAt
);

public record MacroProgressItem(
    [property: JsonPropertyName("current")] decimal Current,
    [property: JsonPropertyName("target")] decimal Target,
    [property: JsonPropertyName("remaining")] decimal Remaining
);

public record MacroPercentages(
    [property: JsonPropertyName("calories")] decimal Calories,
    [property: JsonPropertyName("protein")] decimal Protein,
    [property: JsonPropertyName("fat")] decimal Fat,
    [property: JsonPropertyName("carbs")] decimal Carbs
);

public record MacroProgressResponse(
    [property: JsonPropertyName("calories")] MacroProgressItem Calories,
    [property: JsonPropertyName("protein")] MacroProgressItem Protein,
    [property: JsonPropertyName("fat")] MacroProgressItem Fat,
    [property: JsonPropertyName("carbs")] MacroProgressItem Carbs,
    [property: JsonPropertyName("remainingCalories")] decimal RemainingCalories,
    [property: JsonPropertyName("remainingProtein")] decimal RemainingProtein,
    [property: JsonPropertyName("percentages")] MacroPercentages Percentages
);
