using System.Net;
using System.Text.Json;
using Ediens.Api.Features.Common;
using Xunit;

namespace Ediens.Tests;

public class MultiTenantSecurityTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public MultiTenantSecurityTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task AccessForeignHouseholdInventory_Returns403Forbidden_WithProblemDetails()
    {
        // Користувач Олег намагається отримати доступ до запасів чужого домогосподарства
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var response = await client.GetAsync(
            $"/api/v1/inventory/items?householdId={DatabaseSeeder.StrangerHouseholdId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(403, root.GetProperty("status").GetInt32());
        Assert.Equal("HOUSEHOLD_ACCESS_DENIED", root.GetProperty("errorCode").GetString());
        Assert.Equal("https://ediens.app/errors/household-access-denied", root.GetProperty("type").GetString());
    }

    [Fact]
    public async Task Stranger_AccessMainHouseholdShoppingList_Returns403Forbidden()
    {
        // Сторонній користувач намагається прочитати список покупок сім'ї Олега
        var client = _app.CreateUserClient(DatabaseSeeder.StrangerUserId);

        var response = await client.GetAsync(
            $"/api/v1/households/{DatabaseSeeder.MainHouseholdId}/shopping-list");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RegisteredHouseholdMember_AccessAllowed()
    {
        // Анна є зареєстрованим членом домогосподарства Олега — доступ дозволено
        var client = _app.CreateUserClient(DatabaseSeeder.AnnaUserId);

        var response = await client.GetAsync(
            $"/api/v1/inventory/items?householdId={DatabaseSeeder.MainHouseholdId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
