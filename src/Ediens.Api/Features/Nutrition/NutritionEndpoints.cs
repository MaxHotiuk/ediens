using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
using Ediens.Api.Features.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Nutrition;

public static class NutritionEndpoints
{
    public static IEndpointRouteBuilder MapNutritionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/nutrition/targets")
            .WithTags("Nutrition");

        // 1. PUT /api/v1/nutrition/targets
        group.MapPut("", async (
            SetNutritionTargetsRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            // Валідація діапазонів КБЖВ
            var errors = new Dictionary<string, string[]>();
            if (request.TargetCalories < 500 || request.TargetCalories > 10000)
                errors["targetCalories"] = new[] { "TargetCalories must be between 500 and 10000 kcal." };
            if (request.TargetProtein < 20 || request.TargetProtein > 500)
                errors["targetProtein"] = new[] { "TargetProtein must be between 20 and 500 g." };
            if (request.TargetFat < 10 || request.TargetFat > 300)
                errors["targetFat"] = new[] { "TargetFat must be between 10 and 300 g." };
            if (request.TargetCarbs < 20 || request.TargetCarbs > 1000)
                errors["targetCarbs"] = new[] { "TargetCarbs must be between 20 and 1000 g." };

            if (errors.Count > 0)
            {
                return EdiensResults.ValidationProblem(context.Request.Path, errors: errors);
            }

            DateOnly effectiveDate;
            if (!string.IsNullOrWhiteSpace(request.EffectiveFrom) &&
                DateOnly.TryParse(request.EffectiveFrom, out var parsedDate))
            {
                effectiveDate = parsedDate;
            }
            else
            {
                effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow);
            }

            var target = await db.NutritionTargets
                .FirstOrDefaultAsync(t => t.UserId == userId && t.EffectiveFrom == effectiveDate, ct);

            if (target != null)
            {
                target.TargetCalories = request.TargetCalories;
                target.TargetProtein = request.TargetProtein;
                target.TargetFat = request.TargetFat;
                target.TargetCarbs = request.TargetCarbs;
            }
            else
            {
                target = new NutritionTarget
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    TargetCalories = request.TargetCalories,
                    TargetProtein = request.TargetProtein,
                    TargetFat = request.TargetFat,
                    TargetCarbs = request.TargetCarbs,
                    EffectiveFrom = effectiveDate,
                    CreatedAt = DateTime.UtcNow
                };
                db.NutritionTargets.Add(target);
            }

            await db.SaveChangesAsync(ct);

            var response = new NutritionTargetsResponse(
                Id: target.Id,
                UserId: target.UserId,
                TargetCalories: target.TargetCalories,
                TargetProtein: target.TargetProtein,
                TargetFat: target.TargetFat,
                TargetCarbs: target.TargetCarbs,
                EffectiveFrom: target.EffectiveFrom.ToString("yyyy-MM-dd"),
                UpdatedAt: DateTime.UtcNow
            );

            return Results.Ok(response);
        })
        .WithName("SetNutritionTargets")
        .WithSummary("Встановити або оновити цільовий профіль КБЖВ");

        // 2. GET /api/v1/nutrition/targets
        group.MapGet("", async (
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var target = await db.NutritionTargets
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.EffectiveFrom)
                .FirstOrDefaultAsync(ct);

            if (target == null)
            {
                // Повертаємо базовий профіль за замовчуванням
                target = new NutritionTarget
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    TargetCalories = 2200m,
                    TargetProtein = 160m,
                    TargetFat = 65m,
                    TargetCarbs = 240m,
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
                    CreatedAt = DateTime.UtcNow
                };
                db.NutritionTargets.Add(target);
                await db.SaveChangesAsync(ct);
            }

            var response = new NutritionTargetsResponse(
                Id: target.Id,
                UserId: target.UserId,
                TargetCalories: target.TargetCalories,
                TargetProtein: target.TargetProtein,
                TargetFat: target.TargetFat,
                TargetCarbs: target.TargetCarbs,
                EffectiveFrom: target.EffectiveFrom.ToString("yyyy-MM-dd"),
                UpdatedAt: target.CreatedAt
            );

            return Results.Ok(response);
        })
        .WithName("GetNutritionTargets")
        .WithSummary("Отримати поточний цільовий профіль КБЖВ користувача");

        return endpoints;
    }
}
