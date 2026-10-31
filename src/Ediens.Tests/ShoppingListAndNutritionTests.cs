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

    [Fact]
    public async Task TransferToInventory_PurchasedItems_TransfersToInventoryItemsAndRemovesFromShoppingList()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);
        var householdId = DatabaseSeeder.MainHouseholdId;

        var dairyId = Guid.NewGuid();
        var grainId = Guid.NewGuid();
        var frozenId = Guid.NewGuid();
        var unpurchasedId = Guid.NewGuid();

        // 1. Sync items into shopping list
        var syncRequest = new ShoppingListSyncRequest(
            LastSyncTimestamp: DateTime.UtcNow.AddMinutes(-5),
            ClientChanges: new List<ShoppingListClientChange>
            {
                new(dairyId, "Сир кисломолочний 5%", 400m, "g", true, DateTime.UtcNow),
                new(grainId, "Вівсяні пластівці органічні", 500m, "g", true, DateTime.UtcNow),
                new(frozenId, "Заморожені вишні", 300m, "g", true, DateTime.UtcNow),
                new(unpurchasedId, "Яблука Голден", 1000m, "g", false, DateTime.UtcNow)
            }
        );

        var syncRes = await client.PostAsJsonAsync($"/api/v1/households/{householdId}/shopping-list/sync", syncRequest);
        Assert.Equal(HttpStatusCode.OK, syncRes.StatusCode);

        // 2. Execute transfer to inventory
        var transferRes = await client.PostAsJsonAsync(
            $"/api/v1/households/{householdId}/shopping-list/transfer-to-inventory",
            new TransferShoppingListToInventoryRequest());

        Assert.Equal(HttpStatusCode.OK, transferRes.StatusCode);
        var transferResult = await transferRes.Content.ReadFromJsonAsync<TransferShoppingListResponse>();
        Assert.NotNull(transferResult);
        Assert.True(transferResult.TransferredCount >= 3);

        // Verify smart defaults
        var dairyItem = transferResult.TransferredItems.FirstOrDefault(i => i.ProductName.Contains("Сир"));
        Assert.NotNull(dairyItem);
        Assert.Equal("Fridge", dairyItem.Location);
        Assert.True((dairyItem.ExpiresAt.Date - DateTime.UtcNow.Date).TotalDays <= 5);

        var grainItem = transferResult.TransferredItems.FirstOrDefault(i => i.ProductName.Contains("Вівсяні"));
        Assert.NotNull(grainItem);
        Assert.Equal("Pantry", grainItem.Location);
        Assert.True((grainItem.ExpiresAt.Date - DateTime.UtcNow.Date).TotalDays >= 85);

        var frozenItem = transferResult.TransferredItems.FirstOrDefault(i => i.ProductName.Contains("Заморожені"));
        Assert.NotNull(frozenItem);
        Assert.Equal("Freezer", frozenItem.Location);
        Assert.True((frozenItem.ExpiresAt.Date - DateTime.UtcNow.Date).TotalDays >= 170);

        // 3. Verify real inventory items exist
        var invRes = await client.GetAsync($"/api/v1/inventory/items?householdId={householdId}");
        Assert.Equal(HttpStatusCode.OK, invRes.StatusCode);
        var invData = await invRes.Content.ReadAsStringAsync();
        Assert.Contains("Сир кисломолочний 5%", invData);
        Assert.Contains("Вівсяні пластівці органічні", invData);
        Assert.Contains("Заморожені вишні", invData);

        // 4. Verify removed from shopping list
        var slRes = await client.GetAsync($"/api/v1/households/{householdId}/shopping-list");
        Assert.Equal(HttpStatusCode.OK, slRes.StatusCode);
        var slData = await slRes.Content.ReadFromJsonAsync<ShoppingListSyncResponse>();
        Assert.NotNull(slData);
        Assert.DoesNotContain(slData.Items, i => i.Id == dairyId);
        Assert.DoesNotContain(slData.Items, i => i.Id == grainId);
        Assert.DoesNotContain(slData.Items, i => i.Id == frozenId);
        Assert.Contains(slData.Items, i => i.Id == unpurchasedId);
    }

    [Fact]
    public async Task TransferToInventory_WithCustomOverrides_AppliesSpecifiedLocationAndExpiry()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);
        var householdId = DatabaseSeeder.MainHouseholdId;

        var customItemId = Guid.NewGuid();
        var syncRequest = new ShoppingListSyncRequest(
            LastSyncTimestamp: DateTime.UtcNow,
            ClientChanges: new List<ShoppingListClientChange>
            {
                new(customItemId, "Масло солодковершкове", 200m, "g", true, DateTime.UtcNow)
            }
        );

        await client.PostAsJsonAsync($"/api/v1/households/{householdId}/shopping-list/sync", syncRequest);

        var customExpiry = DateTime.UtcNow.Date.AddDays(45);
        var transferReq = new TransferShoppingListToInventoryRequest(
            Items: new List<TransferShoppingListItemRequest>
            {
                new(
                    ItemId: customItemId,
                    Location: "Freezer",
                    ExpiresAt: customExpiry,
                    Quantity: 250m,
                    Unit: "g"
                )
            }
        );

        var transferRes = await client.PostAsJsonAsync(
            $"/api/v1/households/{householdId}/shopping-list/transfer-to-inventory",
            transferReq);

        Assert.Equal(HttpStatusCode.OK, transferRes.StatusCode);
        var result = await transferRes.Content.ReadFromJsonAsync<TransferShoppingListResponse>();
        Assert.NotNull(result);
        var transferred = result.TransferredItems.FirstOrDefault(i => i.ProductName.Contains("Масло"));
        Assert.NotNull(transferred);
        Assert.Equal("Freezer", transferred.Location);
        Assert.Equal(250m, transferred.Quantity);
        Assert.Equal(customExpiry, transferred.ExpiresAt.Date);
    }

    [Fact]
    public async Task TransferToInventory_NonHouseholdMember_ReturnsForbidden()
    {
        var strangerClient = _app.CreateUserClient(DatabaseSeeder.StrangerUserId);
        var householdId = DatabaseSeeder.MainHouseholdId;

        var transferRes = await strangerClient.PostAsJsonAsync(
            $"/api/v1/households/{householdId}/shopping-list/transfer-to-inventory",
            new TransferShoppingListToInventoryRequest());

        Assert.Equal(HttpStatusCode.Forbidden, transferRes.StatusCode);
    }
}

