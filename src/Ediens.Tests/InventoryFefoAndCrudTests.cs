using System.Net;
using System.Net.Http.Json;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Inventory;
using Xunit;

namespace Ediens.Tests;

public class InventoryFefoAndCrudTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public InventoryFefoAndCrudTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task Inventory_Items_SortedStrictlyByFEFO()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var date1 = DateTime.UtcNow.AddDays(1);
        var date5 = DateTime.UtcNow.AddDays(5);
        var date10 = DateTime.UtcNow.AddDays(10);

        // Додаємо партії в довільному порядку: спочатку +10 днів, потім +1 день, потім +5 днів
        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко 'Селянське' 2.5%",
            Location: "Fridge",
            Quantity: 100m,
            Unit: "ml",
            ExpiresAt: date10
        ));

        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко 'Селянське' 2.5%",
            Location: "Fridge",
            Quantity: 200m,
            Unit: "ml",
            ExpiresAt: date1
        ));

        await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко 'Селянське' 2.5%",
            Location: "Fridge",
            Quantity: 150m,
            Unit: "ml",
            ExpiresAt: date5
        ));

        // Отримуємо список запасів
        var response = await client.GetAsync(
            $"/api/v1/inventory/items?householdId={DatabaseSeeder.MainHouseholdId}&location=Fridge");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var list = await response.Content.ReadFromJsonAsync<InventoryItemListResponse>();
        Assert.NotNull(list);
        Assert.True(list.TotalCount >= 3);

        // Перевіряємо монотонне зростання expiresAt (FEFO принцип)
        for (int i = 0; i < list.Items.Count - 1; i++)
        {
            Assert.True(list.Items[i].ExpiresAt <= list.Items[i + 1].ExpiresAt,
                $"FEFO ordering violated: item {i} expires at {list.Items[i].ExpiresAt} while item {i+1} expires at {list.Items[i+1].ExpiresAt}");
        }
    }

    [Fact]
    public async Task DeleteInventoryItem_RemovesItemFromInventory()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var createResponse = await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко для видалення",
            Location: "Fridge",
            Quantity: 50m,
            Unit: "ml",
            ExpiresAt: DateTime.UtcNow.AddDays(1)
        ));

        var created = await createResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(created);

        // Видаляємо партію із зазначенням причини SPOILED
        var deleteResponse = await client.DeleteAsync($"/api/v1/inventory/items/{created.Id}?reason=SPOILED");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Перевіряємо що повторний GET повертає 404
        var getResponse = await client.GetAsync($"/api/v1/inventory/items/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task UpdateInventoryItem_LocationExpirationAndQuantity_Succeeds()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var createResponse = await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Масло вершкове 82%",
            Location: "Fridge",
            Quantity: 400m,
            Unit: "g",
            ExpiresAt: DateTime.UtcNow.AddDays(5)
        ));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(created);

        var newExpiration = DateTime.UtcNow.AddDays(30);
        var patchMessage = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/inventory/items/{created.Id}")
        {
            Content = JsonContent.Create(new UpdateInventoryItemRequest(
                Quantity: 300m,
                Location: "Freezer",
                ExpiresAt: newExpiration
            ))
        };
        patchMessage.Headers.Add("If-Match", created.Etag);

        var patchResponse = await client.SendAsync(patchMessage);
        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);

        var updated = await patchResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Freezer", updated.Location);
        Assert.Equal(300m, updated.Quantity);
        Assert.True(patchResponse.Headers.Contains("ETag"));
        Assert.NotEqual(created.Etag, updated.Etag);
    }

    [Fact]
    public async Task UpdateInventoryItem_DropToZero_CleansUpItemFromDatabase()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var createResponse = await client.PostAsJsonAsync("/api/v1/inventory/items", new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Йогурт грецький",
            Location: "Fridge",
            Quantity: 150m,
            Unit: "g",
            ExpiresAt: DateTime.UtcNow.AddDays(3)
        ));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(created);

        // Знижуємо кількість рівно до 0 через PATCH
        var patchMessage = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/inventory/items/{created.Id}")
        {
            Content = JsonContent.Create(new UpdateInventoryItemRequest(Quantity: 0m))
        };
        patchMessage.Headers.Add("If-Match", created.Etag);

        var patchResponse = await client.SendAsync(patchMessage);
        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);

        var updated = await patchResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(updated);
        Assert.Equal(0m, updated.Quantity);

        // Перевіряємо, що запис видалено з бази і більше не повертається по ID
        var getResponse = await client.GetAsync($"/api/v1/inventory/items/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }
}
