using Ediens.Api.Data;
using Ediens.Api.Features.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Households;

public static class HouseholdEndpoints
{
    public static IEndpointRouteBuilder MapHouseholdEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/households")
            .WithTags("Households");

        group.MapGet("", async (
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var memberships = await db.HouseholdMembers
                .Include(m => m.Household)
                .ThenInclude(h => h.Members)
                .Where(m => m.UserId == userId)
                .ToListAsync(ct);

            var result = memberships.Select(m => new HouseholdSummaryResponse(
                Id: m.Household.Id,
                Name: m.Household.Name,
                InviteCode: m.Household.InviteCode,
                Role: m.Role,
                MembersCount: m.Household.Members.Count,
                CreatedAt: m.Household.CreatedAt,
                UpdatedAt: m.Household.UpdatedAt
            )).ToList();

            return Results.Ok(result);
        })
        .WithName("GetHouseholds")
        .WithSummary("Отримати перелік домогосподарств поточного користувача");

        return endpoints;
    }
}
