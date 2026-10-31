using System.Net;
using System.Net.Http.Json;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Nutrition;
using Ediens.Api.Features.ShoppingList;
using Xunit;

namespace Ediens.Tests;

public class ShoppingListAndNutritionTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public ShoppingListAndNutritionTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task ShoppingListSync_OfflineFirstMerge_MergesClientChanges()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var itemId1 = Guid.NewGuid();
        var itemId2 = Guid.NewGuid();

        var syncRequest = new ShoppingListSyncRequest(
            LastSyncTimestamp: DateTime.UtcNow.AddHours(-1),
            ClientChanges: new List<ShoppingListClientChange>
            {
                new(
                    Id: itemId1,
                    ProductName: "Яйця курячі С0",
                    Quantity: 10m,
                    Unit: "pcs",
                    IsPurchased: false,
                    ClientUpdatedAt: DateTime.UtcNow
                ),
                new(
                    Id: itemId2,
                    ProductName: "Сир кисломолочний 5%",
                    Quantity: 400m,
                    Unit: "g",
                    IsPurchased: true,
                    ClientUpdatedAt: DateTime.UtcNow
                )
            }
        );

        var syncResponse = await client.PostAsJsonAsync(
            $"/api/v1/households/{DatabaseSeeder.MainHouseholdId}/shopping-list/sync", syncRequest);

        Assert.Equal(HttpStatusCode.OK, syncResponse.StatusCode);

        var syncResult = await syncResponse.Content.ReadFromJsonAsync<ShoppingListSyncResponse>();
        Assert.NotNull(syncResult);
        Assert.True(syncResult.Items.Count >= 2);
        Assert.Contains(syncResult.Items, i => i.ProductName == "Яйця курячі С0" && !i.IsPurchased);
        Assert.Contains(syncResult.Items, i => i.ProductName == "Сир кисломолочний 5%" && i.IsPurchased);
    }

    [Fact]
    public async Task NutritionTargets_SetAndGet_UpdatesProfileSuccessfully()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var setRequest = new SetNutritionTargetsRequest(
            TargetCalories: 2600m,
            TargetProtein: 185m,
            TargetFat: 75m,
            TargetCarbs: 280m,
            EffectiveFrom: DateTime.UtcNow.ToString("yyyy-MM-dd")
        );

        var putResponse = await client.PutAsJsonAsync("/api/v1/nutrition/targets", setRequest);
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await client.GetAsync("/api/v1/nutrition/targets");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var target = await getResponse.Content.ReadFromJsonAsync<NutritionTargetsResponse>();
        Assert.NotNull(target);
        Assert.Equal(2600m, target.TargetCalories);
        Assert.Equal(185m, target.TargetProtein);
        Assert.Equal(75m, target.TargetFat);
        Assert.Equal(280m, target.TargetCarbs);
    }
}
