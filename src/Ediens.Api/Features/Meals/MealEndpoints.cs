using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
using Ediens.Api.Features.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Meals;

public static class MealEndpoints
{
    public static IEndpointRouteBuilder MapMealEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/meals")
            .WithTags("Nutrition");

        group.MapPost("/log", async (
            CreateMealLogRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (request.Items == null || request.Items.Count == 0)
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    errors: new Dictionary<string, string[]>
                    {
                        ["items"] = new[] { "Meal log must include at least one item." }
                    });
            }

            var validMealTypes = new[] { "Breakfast", "Lunch", "Dinner", "Snack" };
            if (!validMealTypes.Contains(request.MealType, StringComparer.OrdinalIgnoreCase))
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    errors: new Dictionary<string, string[]>
                    {
                        ["mealType"] = new[] { $"MealType '{request.MealType}' is invalid. Permitted: Breakfast, Lunch, Dinner, Snack." }
                    });
            }

            decimal totalCalories = 0m;
            decimal totalProtein = 0m;
            decimal totalFat = 0m;
            decimal totalCarbs = 0m;

            var mealLogId = Guid.NewGuid();
            var logItems = new List<MealLogItem>();

            foreach (var itemInput in request.Items)
            {
                if (itemInput.Quantity <= 0 || string.IsNullOrWhiteSpace(itemInput.ProductName))
                {
                    return EdiensResults.ValidationProblem(
                        context.Request.Path,
                        errors: new Dictionary<string, string[]>
                        {
                            ["quantity"] = new[] { "Quantity must be greater than 0." },
                            ["productName"] = new[] { "ProductName is required." }
                        });
                }

                Product? product = null;
                if (itemInput.ProductId.HasValue)
                {
                    product = await db.Products.FindAsync(new object[] { itemInput.ProductId.Value }, ct);
                }

                if (product == null)
                {
                    product = await db.Products.FirstOrDefaultAsync(
                        p => p.Name.ToLower() == itemInput.ProductName.ToLower(), ct);
                }

                if (product == null)
                {
                    product = new Product
                    {
                        Id = Guid.NewGuid(),
                        Name = itemInput.ProductName.Trim(),
                        CaloriesPer100g = 120m,
                        ProteinPer100g = 6m,
                        FatPer100g = 4m,
                        CarbsPer100g = 15m,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    db.Products.Add(product);
                    await db.SaveChangesAsync(ct);
                }

                decimal ratio = itemInput.Unit.Equals("pcs", StringComparison.OrdinalIgnoreCase)
                    ? itemInput.Quantity
                    : itemInput.Quantity / 100.0m;

                decimal itemCal = Math.Round(product.CaloriesPer100g * ratio, 1);
                decimal itemProt = Math.Round(product.ProteinPer100g * ratio, 1);
                decimal itemFat = Math.Round(product.FatPer100g * ratio, 1);
                decimal itemCarbs = Math.Round(product.CarbsPer100g * ratio, 1);

                totalCalories += itemCal;
                totalProtein += itemProt;
                totalFat += itemFat;
                totalCarbs += itemCarbs;

                logItems.Add(new MealLogItem
                {
                    Id = Guid.NewGuid(),
                    MealLogId = mealLogId,
                    ProductId = product.Id,
                    Product = product,
                    Quantity = itemInput.Quantity,
                    Unit = itemInput.Unit,
                    Calories = itemCal,
                    Protein = itemProt,
                    Fat = itemFat,
                    Carbs = itemCarbs
                });
            }

            // Отримуємо або створюємо цільовий профіль користувача
            var target = await db.NutritionTargets
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.EffectiveFrom)
                .FirstOrDefaultAsync(ct);

            var targetCalories = target?.TargetCalories ?? 2200.0m;
            var targetProtein = target?.TargetProtein ?? 160.0m;
            var targetFat = target?.TargetFat ?? 65.0m;
            var targetCarbs = target?.TargetCarbs ?? 240.0m;

            // Підрахунок споживання за день
            var logDate = request.LoggedAt.Date.ToUniversalTime();
            var nextDate = logDate.AddDays(1);

            var existingMeals = await db.MealLogs
                .Where(m => m.UserId == userId && m.LoggedAt >= logDate && m.LoggedAt < nextDate)
                .ToListAsync(ct);

            decimal loggedCalToday = existingMeals.Sum(m => m.Calories) + totalCalories;
            decimal loggedProtToday = existingMeals.Sum(m => m.Protein) + totalProtein;
            decimal loggedFatToday = existingMeals.Sum(m => m.Fat) + totalFat;
            decimal loggedCarbsToday = existingMeals.Sum(m => m.Carbs) + totalCarbs;

            var remainingBudget = new MacroBudgetValues(
                Calories: Math.Round(targetCalories - loggedCalToday, 1),
                Protein: Math.Round(targetProtein - loggedProtToday, 1),
                Fat: Math.Round(targetFat - loggedFatToday, 1),
                Carbs: Math.Round(targetCarbs - loggedCarbsToday, 1)
            );

            // Перевіряємо Idempotency-Key
            Guid? idempotencyGuid = null;
            if (context.Request.Headers.TryGetValue("Idempotency-Key", out var ikeyHeader) &&
                Guid.TryParse(ikeyHeader.FirstOrDefault(), out var parsedIkey))
            {
                idempotencyGuid = parsedIkey;
            }

            var mealLog = new MealLog
            {
                Id = mealLogId,
                UserId = userId,
                MealType = request.MealType,
                LoggedAt = request.LoggedAt.ToUniversalTime(),
                Calories = totalCalories,
                Protein = totalProtein,
                Fat = totalFat,
                Carbs = totalCarbs,
                IdempotencyKey = idempotencyGuid,
                CreatedAt = DateTime.UtcNow,
                Items = logItems
            };

            db.MealLogs.Add(mealLog);
            await db.SaveChangesAsync(ct);

            var response = new MealLogResponse(
                Id: mealLog.Id,
                UserId: mealLog.UserId,
                MealType: mealLog.MealType,
                LoggedAt: mealLog.LoggedAt,
                Calories: mealLog.Calories,
                Protein: mealLog.Protein,
                Fat: mealLog.Fat,
                Carbs: mealLog.Carbs,
                ItemsCount: logItems.Count,
                RemainingBudgetToday: remainingBudget
            );

            return Results.Created($"/api/v1/meals/{mealLog.Id}", response);
        })
        .WithName("LogMealIntake")
        .WithSummary("Залогувати прийом їжі у щоденник харчування");

        return endpoints;
    }
}
