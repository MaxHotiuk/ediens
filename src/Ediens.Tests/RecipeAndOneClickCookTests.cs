using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Inventory;
using Ediens.Api.Features.Recipes;
using Xunit;

namespace Ediens.Tests;

public class RecipeAndOneClickCookTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public RecipeAndOneClickCookTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task CookRecipe_InsufficientInventory_Returns422Unprocessable_WithShortfallDetails()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        // Намагаємося приготувати страву, для якої немає продуктів на складі
        var cookRequest = new CookRecipeRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            Servings: 2,
            MealType: "Dinner"
        );

        var response = await client.PostAsJsonAsync(
            $"/api/v1/recipes/{DatabaseSeeder.ChickenDinnerRecipeId}/cook", cookRequest);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(422, root.GetProperty("status").GetInt32());
        Assert.Equal("INSUFFICIENT_INVENTORY", root.GetProperty("errorCode").GetString());

        var ext = root.GetProperty("extensions");
        Assert.Equal(2, ext.GetProperty("requestedServings").GetInt32());

        var missing = ext.GetProperty("missingIngredients");
        Assert.True(missing.GetArrayLength() > 0);
    }

    [Fact]
    public async Task CookRecipe_SufficientInventory_DeductsFEFOBatches_AndLogsMeal()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        // 1. Поповнюємо інвентар необхідними інгредієнтами (2 партії філе для перевірки FEFO)
        // Старіша партія філе: 150г (збігає через 2 дні)
        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.ChickenProductId,
            ProductName: "Куряче філе охолоджене",
            Location: "Fridge",
            Quantity: 150m,
            Unit: "g",
            ExpiresAt: DateTime.UtcNow.AddDays(2)
        ));

        // Новіша партія філе: 200г (збігає через 6 днів)
        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.ChickenProductId,
            ProductName: "Куряче філе охолоджене",
            Location: "Fridge",
            Quantity: 200m,
            Unit: "g",
            ExpiresAt: DateTime.UtcNow.AddDays(6)
        ));

        // Шпинат (100г, потрібно 50г)
        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.SpinachProductId,
            ProductName: "Шпинат свіжий 'Верес'",
            Location: "Fridge",
            Quantity: 100m,
            Unit: "g",
            ExpiresAt: DateTime.UtcNow.AddDays(4)
        ));

        // Гречана крупа (200г, потрібно 80г)
        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.BuckwheatProductId,
            ProductName: "Гречана крупа",
            Location: "Pantry",
            Quantity: 200m,
            Unit: "g",
            ExpiresAt: DateTime.UtcNow.AddMonths(3)
        ));

        // 2. Виконуємо 1-Click Cook на 1 порцію (потрібно 200г філе: спише 150г зі старої партії та 50г з нової)
        var cookRequest = new CookRecipeRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            Servings: 1,
            MealType: "Dinner"
        );

        var cookResponse = await client.PostAsJsonAsync(
            $"/api/v1/recipes/{DatabaseSeeder.ChickenDinnerRecipeId}/cook", cookRequest);

        Assert.Equal(HttpStatusCode.OK, cookResponse.StatusCode);

        var result = await cookResponse.Content.ReadFromJsonAsync<CookRecipeResponse>();
        Assert.NotNull(result);
        Assert.Equal(DatabaseSeeder.ChickenDinnerRecipeId, result.RecipeId);
        Assert.Equal(1, result.ServingsCooked);
        Assert.True(result.DeductedBatches.Count >= 3);

        // Перевіряємо КБЖВ залогованого прийому їжі
        Assert.Equal(520.0m, result.LoggedMacros.Calories);
        Assert.Equal(58.0m, result.LoggedMacros.Protein);
    }

    [Fact]
    public async Task GetRecipeRecommendations_ReturnsScoredRecipes()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var response = await client.GetAsync(
            $"/api/v1/recipes/recommendations?householdId={DatabaseSeeder.MainHouseholdId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<RecipeRecommendationListResponse>();
        Assert.NotNull(result);
        Assert.NotEmpty(result.Recommendations);
        Assert.True(result.Recommendations[0].MatchScore > 0);
    }
}
