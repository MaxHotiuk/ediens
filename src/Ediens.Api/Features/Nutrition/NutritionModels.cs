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
