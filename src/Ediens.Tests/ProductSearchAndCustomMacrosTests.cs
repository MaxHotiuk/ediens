using System.Net;
using System.Net.Http.Json;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Meals;
using Ediens.Api.Features.Products;
using Xunit;

namespace Ediens.Tests;

public class ProductSearchAndCustomMacrosTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public ProductSearchAndCustomMacrosTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task ProductSearch_CaseInsensitiveQuery_ReturnsMatchingProducts()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        // 1. Search by product name (lowercase search for "вівсяні")
        var responseByName = await client.GetAsync("/api/v1/products/search?query=вівсяні&limit=5");
        Assert.Equal(HttpStatusCode.OK, responseByName.StatusCode);

        var productsByName = await responseByName.Content.ReadFromJsonAsync<List<ProductSearchItemDto>>();
        Assert.NotNull(productsByName);
        Assert.NotEmpty(productsByName);
        Assert.Contains(productsByName, p => p.Name.Contains("Вівсяні", StringComparison.OrdinalIgnoreCase));

        // 2. Search by brand ("яготинське")
        var responseByBrand = await client.GetAsync("/api/v1/products/search?query=яготинське");
        Assert.Equal(HttpStatusCode.OK, responseByBrand.StatusCode);

        var productsByBrand = await responseByBrand.Content.ReadFromJsonAsync<List<ProductSearchItemDto>>();
        Assert.NotNull(productsByBrand);
        Assert.NotEmpty(productsByBrand);
        Assert.Contains(productsByBrand, p => p.Brand != null && p.Brand.Contains("Яготинське", StringComparison.OrdinalIgnoreCase));

        // 3. Search with empty string returns empty list
        var emptyResponse = await client.GetAsync("/api/v1/products/search?query=");
        Assert.Equal(HttpStatusCode.OK, emptyResponse.StatusCode);

        var emptyList = await emptyResponse.Content.ReadFromJsonAsync<List<ProductSearchItemDto>>();
        Assert.NotNull(emptyList);
        Assert.Empty(emptyList);
    }

    [Fact]
    public async Task MealLog_WithCustomNutrition_AppliesCustomValuesInsteadOfFallback()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var customMealRequest = new CreateMealLogRequest(
            MealType: "Lunch",
            LoggedAt: DateTime.UtcNow,
            Items: new List<MealLogItemInput>
            {
                new(
                    ProductId: null,
                    ProductName: "Фірмовий білковий смузі",
                    Quantity: 300m,
                    Unit: "ml",
                    Calories: 450m,
                    Protein: 35m,
                    Fat: 12m,
                    Carbs: 48m
                )
            }
        );

        var response = await client.PostAsJsonAsync("/api/v1/meals/log", customMealRequest);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<MealLogResponse>();
        Assert.NotNull(result);
        Assert.Equal(450m, result.Calories);
        Assert.Equal(35m, result.Protein);
        Assert.Equal(12m, result.Fat);
        Assert.Equal(48m, result.Carbs);
    }

    [Fact]
    public async Task MealLog_WithPieceUnit_ComputesRealisticPerUnitMacros()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        // First create a product with 100g nutritional profile
        // e.g. eggs: 143 kcal per 100g. 1 piece (~55g) should be ~78.7 kcal, NOT 143 kcal!
        var eggMealRequest = new CreateMealLogRequest(
            MealType: "Breakfast",
            LoggedAt: DateTime.UtcNow,
            Items: new List<MealLogItemInput>
            {
                new(
                    ProductId: null,
                    ProductName: "Яйця варені",
                    Quantity: 2m, // 2 eggs
                    Unit: "pcs"
                )
            }
        );

        var response = await client.PostAsJsonAsync("/api/v1/meals/log", eggMealRequest);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<MealLogResponse>();
        Assert.NotNull(result);
        // Ratio for 2 eggs is 2 * 0.55 = 1.1 (instead of 2.0 = 200g blind ratio)
        // Default 120 kcal * 1.1 = 132 kcal (instead of 240 kcal)
        Assert.True(result.Calories < 200m, $"Expected realistic calories for 2 eggs < 200 kcal, got {result.Calories}");
    }
}
