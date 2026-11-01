using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Households;
using Xunit;

namespace Ediens.Tests;

public class HouseholdAndMemberManagementTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public HouseholdAndMemberManagementTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task GetHouseholds_ReturnsHouseholdsForAuthenticatedUser()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var response = await client.GetAsync("/api/v1/households");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var households = await response.Content.ReadFromJsonAsync<List<HouseholdSummaryResponse>>();
        Assert.NotNull(households);
        Assert.NotEmpty(households);
        Assert.Contains(households, h => h.Id == DatabaseSeeder.MainHouseholdId && h.Role == "Owner");
    }

    [Fact]
    public async Task JoinHousehold_ValidInviteCode_AddsUserAsMember()
    {
        // Створюємо нового унікального користувача
        var newUserId = Guid.NewGuid();
        var client = _app.CreateUserClient(newUserId);

        var joinRequest = new JoinHouseholdRequest("EDIENS-77");
        var response = await client.PostAsJsonAsync("/api/v1/households/join", joinRequest);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var joined = await response.Content.ReadFromJsonAsync<HouseholdSummaryResponse>();
        Assert.NotNull(joined);
        Assert.Equal(DatabaseSeeder.MainHouseholdId, joined.Id);
        Assert.Equal("Member", joined.Role);

        // Перевіряємо, що тепер цей користувач має доступ до учасників
        var membersResponse = await client.GetAsync($"/api/v1/households/{DatabaseSeeder.MainHouseholdId}/members");
        Assert.Equal(HttpStatusCode.OK, membersResponse.StatusCode);

        var members = await membersResponse.Content.ReadFromJsonAsync<List<HouseholdMemberResponse>>();
        Assert.NotNull(members);
        Assert.Contains(members, m => m.UserId == newUserId && m.Role == "Member");
    }

    [Fact]
    public async Task JoinHousehold_InvalidInviteCode_Returns404NotFound_WithProblemDetails()
    {
        var client = _app.CreateUserClient(Guid.NewGuid());
        var joinRequest = new JoinHouseholdRequest("NON-EXISTENT-CODE");

        var response = await client.PostAsJsonAsync("/api/v1/households/join", joinRequest);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(404, root.GetProperty("status").GetInt32());
        Assert.Equal("ITEM_NOT_FOUND", root.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task JoinHousehold_EmptyCode_Returns400BadRequest()
    {
        var client = _app.CreateUserClient(Guid.NewGuid());
        var joinRequest = new JoinHouseholdRequest("   ");

        var response = await client.PostAsJsonAsync("/api/v1/households/join", joinRequest);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Equal("VALIDATION_FAILED", root.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task GetHouseholdMembers_RegisteredMember_ReturnsMembersList()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.AnnaUserId);

        var response = await client.GetAsync($"/api/v1/households/{DatabaseSeeder.MainHouseholdId}/members");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var members = await response.Content.ReadFromJsonAsync<List<HouseholdMemberResponse>>();
        Assert.NotNull(members);
        Assert.Contains(members, m => m.UserId == DatabaseSeeder.OlegUserId && m.Role == "Owner");
        Assert.Contains(members, m => m.UserId == DatabaseSeeder.AnnaUserId && m.Role == "Member");
    }

    [Fact]
    public async Task GetHouseholdMembers_Stranger_Returns403Forbidden()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.StrangerUserId);

        var response = await client.GetAsync($"/api/v1/households/{DatabaseSeeder.MainHouseholdId}/members");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(403, root.GetProperty("status").GetInt32());
        Assert.Equal("HOUSEHOLD_ACCESS_DENIED", root.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task GetHouseholdMembers_NonExistentHousehold_Returns404NotFound()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);
        var nonExistentId = Guid.NewGuid();

        var response = await client.GetAsync($"/api/v1/households/{nonExistentId}/members");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
