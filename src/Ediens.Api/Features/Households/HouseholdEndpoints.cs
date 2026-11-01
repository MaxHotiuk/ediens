using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
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

        // 1. GET /api/v1/households — перелік домогосподарств поточного користувача
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

        // 2. GET /api/v1/households/{id} — детальне домогосподарство
        group.MapGet("/{id:guid}", async (
            Guid id,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var membership = await db.HouseholdMembers
                .Include(m => m.Household)
                .ThenInclude(h => h.Members)
                .FirstOrDefaultAsync(m => m.HouseholdId == id && m.UserId == userId, ct);

            if (membership == null)
            {
                var exists = await db.Households.AnyAsync(h => h.Id == id, ct);
                if (!exists)
                {
                    return EdiensResults.NotFound(
                        context.Request.Path,
                        $"Household '{id}' could not be found.",
                        resourceType: "Household",
                        resourceId: id.ToString());
                }

                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{id}'.",
                    householdId: id);
            }

            var result = new HouseholdSummaryResponse(
                Id: membership.Household.Id,
                Name: membership.Household.Name,
                InviteCode: membership.Household.InviteCode,
                Role: membership.Role,
                MembersCount: membership.Household.Members.Count,
                CreatedAt: membership.Household.CreatedAt,
                UpdatedAt: membership.Household.UpdatedAt
            );

            return Results.Ok(result);
        })
        .WithName("GetHouseholdById")
        .WithSummary("Отримати інформацію про конкретне домогосподарство");

        // 3. POST /api/v1/households/join — приєднання до домогосподарства за кодом запрошення
        group.MapPost("/join", async (
            JoinHouseholdRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            if (request == null || string.IsNullOrWhiteSpace(request.InviteCode))
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    detail: "Код запрошення не може бути порожнім.",
                    errors: new Dictionary<string, string[]>
                    {
                        ["inviteCode"] = new[] { "Invite code is required." }
                    });
            }

            var cleanCode = request.InviteCode.Trim();
            var household = await db.Households
                .Include(h => h.Members)
                .FirstOrDefaultAsync(h => h.InviteCode.ToUpper() == cleanCode.ToUpper(), ct);

            if (household == null)
            {
                return EdiensResults.NotFound(
                    context.Request.Path,
                    $"Household with invite code '{cleanCode}' could not be found.",
                    resourceType: "Household",
                    resourceId: cleanCode);
            }

            var userId = UserContext.GetCurrentUserId(context);

            // Перевіряємо існування користувача в БД (для підтримки динамічних тестових користувачів)
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user == null)
            {
                user = new User
                {
                    Id = userId,
                    Email = $"user-{userId.ToString()[..8]}@ediens.app",
                    PasswordHash = "system_generated_hash",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                db.Users.Add(user);
                await db.SaveChangesAsync(ct);
            }

            var membership = await db.HouseholdMembers
                .FirstOrDefaultAsync(m => m.HouseholdId == household.Id && m.UserId == userId, ct);

            if (membership == null)
            {
                membership = new HouseholdMember
                {
                    HouseholdId = household.Id,
                    UserId = userId,
                    Role = "Member",
                    JoinedAt = DateTime.UtcNow
                };
                db.HouseholdMembers.Add(membership);
                await db.SaveChangesAsync(ct);
            }

            var membersCount = await db.HouseholdMembers.CountAsync(m => m.HouseholdId == household.Id, ct);

            var response = new HouseholdSummaryResponse(
                Id: household.Id,
                Name: household.Name,
                InviteCode: household.InviteCode,
                Role: membership.Role,
                MembersCount: membersCount,
                CreatedAt: household.CreatedAt,
                UpdatedAt: household.UpdatedAt
            );

            return Results.Ok(response);
        })
        .WithName("JoinHousehold")
        .WithSummary("Приєднатися до домогосподарства за кодом запрошення");

        // 4. GET /api/v1/households/{id}/members — перелік учасників домогосподарства
        group.MapGet("/{id:guid}/members", async (
            Guid id,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var householdExists = await db.Households.AnyAsync(h => h.Id == id, ct);
            if (!householdExists)
            {
                return EdiensResults.NotFound(
                    context.Request.Path,
                    $"Household '{id}' could not be found.",
                    resourceType: "Household",
                    resourceId: id.ToString());
            }

            if (!await HouseholdAccessValidator.IsMemberAsync(db, id, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{id}'.",
                    householdId: id);
            }

            var members = await db.HouseholdMembers
                .Include(m => m.User)
                .Where(m => m.HouseholdId == id)
                .OrderBy(m => m.JoinedAt)
                .Select(m => new HouseholdMemberResponse(
                    m.UserId,
                    m.User.Email,
                    m.Role,
                    m.JoinedAt
                ))
                .ToListAsync(ct);

            return Results.Ok(members);
        })
        .WithName("GetHouseholdMembers")
        .WithSummary("Отримати перелік учасників домогосподарства");

        return endpoints;
    }
}
