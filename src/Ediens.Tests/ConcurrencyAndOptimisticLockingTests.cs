using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ediens.Api.Common.Errors;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Inventory;
using Xunit;

namespace Ediens.Tests;

public class ConcurrencyAndOptimisticLockingTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public ConcurrencyAndOptimisticLockingTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task UpdateInventoryItem_WithMatchingETag_SucceedsAndReturnsNewETag()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        // 1. Створюємо партію молока (1000 мл)
        var createRequest = new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко 'Селянське' 2.5%",
            Location: "Fridge",
            Quantity: 1000m,
            Unit: "ml",
            ExpiresAt: DateTime.UtcNow.AddDays(7)
        );

        var createResponse = await client.PostAsJsonAsync("/api/v1/inventory/items", createRequest);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var createdItem = await createResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(createdItem);
        Assert.Equal(1000m, createdItem.Quantity);
        Assert.Equal("W/\"1\"", createdItem.Etag);

        // 2. Споживаємо 400 мл з валідним If-Match
        var patchMessage = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/inventory/items/{createdItem.Id}")
        {
            Content = JsonContent.Create(new UpdateInventoryItemQuantityRequest(-400m, MarkOpened: true))
        };
        patchMessage.Headers.Add("If-Match", createdItem.Etag);

        var patchResponse = await client.SendAsync(patchMessage);
        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);

        var updatedItem = await patchResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(updatedItem);
        Assert.Equal(600m, updatedItem.Quantity);
        Assert.Equal("W/\"2\"", updatedItem.Etag);
        Assert.NotNull(updatedItem.OpenedAt);
    }

    [Fact]
    public async Task UpdateInventoryItem_WithMismatchedETag_Returns409Conflict_WithProblemDetails()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        // 1. Створюємо партію
        var createRequest = new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко 'Селянське' 2.5%",
            Location: "Fridge",
            Quantity: 800m,
            Unit: "ml",
            ExpiresAt: DateTime.UtcNow.AddDays(5)
        );

        var createResponse = await client.PostAsJsonAsync("/api/v1/inventory/items", createRequest);
        var createdItem = await createResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(createdItem);

        // 2. Перший клієнт успішно змінює партію (версія стає W/"2")
        var patch1 = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/inventory/items/{createdItem.Id}")
        {
            Content = JsonContent.Create(new UpdateInventoryItemQuantityRequest(-200m))
        };
        patch1.Headers.Add("If-Match", "W/\"1\"");
        var resp1 = await client.SendAsync(patch1);
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);

        // 3. Другий клієнт намагається списати товар із застарілим If-Match: W/"1"
        var patch2 = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/inventory/items/{createdItem.Id}")
        {
            Content = JsonContent.Create(new UpdateInventoryItemQuantityRequest(-100m))
        };
        patch2.Headers.Add("If-Match", "W/\"1\"");

        var conflictResponse = await client.SendAsync(patch2);
        Assert.Equal(HttpStatusCode.Conflict, conflictResponse.StatusCode);

        // Перевіряємо ETag актуальної версії в заголовках
        Assert.True(conflictResponse.Headers.Contains("ETag"));
        Assert.Equal("W/\"2\"", conflictResponse.Headers.GetValues("ETag").First());

        // Перевіряємо RFC 9457 ProblemDetails структуру
        var json = await conflictResponse.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(409, root.GetProperty("status").GetInt32());
        Assert.Equal("CONCURRENT_MODIFICATION", root.GetProperty("errorCode").GetString());
        Assert.Equal("https://ediens.app/errors/concurrent-modification", root.GetProperty("type").GetString());

        var ext = root.GetProperty("extensions");
        Assert.Equal("W/\"2\"", ext.GetProperty("currentETag").GetString());
        Assert.Equal(600m, ext.GetProperty("currentQuantity").GetDecimal());
    }

    [Fact]
    public async Task UpdateInventoryItem_ExcessiveDeduction_Returns422UnprocessableContent()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var createRequest = new CreateInventoryItemRequest(
            HouseholdId: DatabaseSeeder.MainHouseholdId,
            ProductId: DatabaseSeeder.MilkProductId,
            ProductName: "Молоко 'Селянське' 2.5%",
            Location: "Fridge",
            Quantity: 300m,
            Unit: "ml",
            ExpiresAt: DateTime.UtcNow.AddDays(3)
        );

        var createResponse = await client.PostAsJsonAsync("/api/v1/inventory/items", createRequest);
        var createdItem = await createResponse.Content.ReadFromJsonAsync<InventoryItemResponse>();
        Assert.NotNull(createdItem);

        // Намагаємося списати 500 мл при наявності лише 300 мл
        var patch = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/inventory/items/{createdItem.Id}")
        {
            Content = JsonContent.Create(new UpdateInventoryItemQuantityRequest(-500m))
        };
        patch.Headers.Add("If-Match", createdItem.Etag);

        var response = await client.SendAsync(patch);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(422, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("INSUFFICIENT_INVENTORY", doc.RootElement.GetProperty("errorCode").GetString());
    }
}
