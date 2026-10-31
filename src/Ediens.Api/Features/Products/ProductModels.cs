using System.Text.Json.Serialization;

namespace Ediens.Api.Features.Products;

public record ProductBarcodeDetailsResponse(
    [property: JsonPropertyName("barcode")] string Barcode,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("brand")] string? Brand,
    [property: JsonPropertyName("caloriesPer100g")] decimal CaloriesPer100g,
    [property: JsonPropertyName("proteinPer100g")] decimal ProteinPer100g,
    [property: JsonPropertyName("fatPer100g")] decimal FatPer100g,
    [property: JsonPropertyName("carbsPer100g")] decimal CarbsPer100g,
    [property: JsonPropertyName("dataSource")] string DataSource,
    [property: JsonPropertyName("isCached")] bool IsCached
);
