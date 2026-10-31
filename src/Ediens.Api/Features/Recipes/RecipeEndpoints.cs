using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Meals;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Recipes;

public static class RecipeEndpoints
{
    public static IEndpointRouteBuilder MapRecipeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/recipes")
            .WithTags("Recipes");

        // 1. GET /api/v1/recipes/recommendations
        group.MapGet("/recommendations", async (
            Guid householdId,
            int? maxPrepTimeMinutes,
            int? limit,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (!await HouseholdAccessValidator.IsMemberAsync(db, householdId, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{householdId}'.",
                    householdId: householdId);
            }

            var limitCount = (limit.HasValue && limit.Value > 0) ? Math.Min(limit.Value, 50) : 10;

            // Завантажуємо активні запаси домогосподарства
            var inventoryItems = await db.InventoryItems
                .Include(i => i.Product)
                .Where(i => i.HouseholdId == householdId && i.Quantity > 0)
                .ToListAsync(ct);

            var now = DateTime.UtcNow;

            // Завантажуємо рецепти з їхніми інгредієнтами
            var query = db.Recipes
                .Include(r => r.Ingredients)
                .ThenInclude(ing => ing.Product)
                .Where(r => r.HouseholdId == null || r.HouseholdId == householdId);

            if (maxPrepTimeMinutes.HasValue && maxPrepTimeMinutes.Value > 0)
            {
                query = query.Where(r => r.PrepTimeMinutes <= maxPrepTimeMinutes.Value);
            }

            var allRecipes = await query.ToListAsync(ct);
            var recommendations = new List<RecipeRecommendationItem>();

            foreach (var recipe in allRecipes)
            {
                int expiringCount = 0;
                int missingCount = 0;
                var ingredientDtos = new List<RecipeIngredientDto>();

                foreach (var ingredient in recipe.Ingredients)
                {
                    var matchingBatches = inventoryItems
                        .Where(i => i.ProductId == ingredient.ProductId ||
                                    (i.Product != null && ingredient.Product != null &&
                                     string.Equals(i.Product.Name, ingredient.Product.Name, StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                    var availableQty = matchingBatches.Sum(b => b.Quantity);
                    bool isAvailable = availableQty >= ingredient.Quantity;
                    if (!isAvailable)
                    {
                        missingCount++;
                    }

                    ingredientDtos.Add(new RecipeIngredientDto(
                        ProductId: ingredient.ProductId,
                        ProductName: ingredient.Product?.Name ?? "Інгредієнт",
                        Quantity: ingredient.Quantity,
                        Unit: ingredient.Unit,
                        IsAvailable: isAvailable
                    ));

                    // Перевіряємо, чи є партії, термін яких збігає < 72 годин
                    if (matchingBatches.Any(b => (b.ExpiresAt - now).TotalHours <= 72))
                    {
                        expiringCount++;
                    }
                }

                bool canCookImmediately = (missingCount == 0);

                // Формула скорингу:
                // Score = 55 + (20 * ExpiringStockMatch) - (25 * MissingIngredients)
                decimal rawScore = 55.0m + (expiringCount * 20.0m) - (missingCount * 25.0m);
                decimal matchScore = Math.Clamp(rawScore, 5.0m, 98.5m);

                recommendations.Add(new RecipeRecommendationItem(
                    RecipeId: recipe.Id,
                    Title: recipe.Title,
                    Description: recipe.Description,
                    Instructions: recipe.Instructions,
                    PrepTimeMinutes: recipe.PrepTimeMinutes,
                    Calories: recipe.TotalCalories,
                    Protein: recipe.TotalProtein,
                    Fat: recipe.TotalFat,
                    Carbs: recipe.TotalCarbs,
                    MatchScore: Math.Round(matchScore, 1),
                    ExpiringIngredientsCount: expiringCount,
                    MissingIngredientsCount: missingCount,
                    CanCookImmediately: canCookImmediately,
                    Ingredients: ingredientDtos
                ));
            }

            var orderedList = recommendations
                .OrderByDescending(r => r.MatchScore)
                .Take(limitCount)
                .ToList();

            var response = new RecipeRecommendationListResponse(
                HouseholdId: householdId,
                GeneratedAt: DateTime.UtcNow,
                Recommendations: orderedList
            );

            return Results.Ok(response);
        })
        .WithName("GetRecipeRecommendations")
        .WithSummary("Отримати рекомендації страв на основі FEFO-запасів та КБЖВ");

        // 2. POST /api/v1/recipes/{id}/cook
        group.MapPost("/{id:guid}/cook", async (
            Guid id,
            CookRecipeRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (request.Servings < 1 || request.Servings > 20)
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    errors: new Dictionary<string, string[]>
                    {
                        ["servings"] = new[] { "Servings must be between 1 and 20." }
                    });
            }

            var recipe = await db.Recipes
                .Include(r => r.Ingredients)
                .ThenInclude(ing => ing.Product)
                .FirstOrDefaultAsync(r => r.Id == id, ct);

            if (recipe == null)
            {
                return EdiensResults.NotFound(
                    context.Request.Path,
                    $"Recipe '{id}' could not be found.",
                    resourceType: "Recipe",
                    resourceId: id.ToString());
            }

            if (!await HouseholdAccessValidator.IsMemberAsync(db, request.HouseholdId, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{request.HouseholdId}'.",
                    householdId: request.HouseholdId);
            }

            // Перевіряємо наявність усіх інгредієнтів в інвентарі домогосподарства
            var missingList = new List<MissingIngredientItem>();
            var requiredPerProduct = new Dictionary<Guid, (decimal required, string unit, string name, Product product)>();

            foreach (var ing in recipe.Ingredients)
            {
                decimal totalRequired = ing.Quantity * request.Servings;
                requiredPerProduct[ing.ProductId] = (totalRequired, ing.Unit, ing.Product.Name, ing.Product);

                var availableInInventory = await db.InventoryItems
                    .Where(i => i.HouseholdId == request.HouseholdId && i.ProductId == ing.ProductId && i.Quantity > 0)
                    .SumAsync(i => i.Quantity, ct);

                if (availableInInventory < totalRequired)
                {
                    missingList.Add(new MissingIngredientItem
                    {
                        ProductId = ing.ProductId,
                        ProductName = ing.Product.Name,
                        RequiredQuantity = totalRequired,
                        AvailableQuantity = availableInInventory,
                        Unit = ing.Unit,
                        Shortfall = totalRequired - availableInInventory
                    });
                }
            }

            // Інваріант: Якщо бодай одного інгредієнта недостатньо — 422 Unprocessable Entity
            if (missingList.Count > 0)
            {
                return EdiensResults.InsufficientInventory(
                    context.Request.Path,
                    $"Cannot cook recipe '{recipe.Title}' for {request.Servings} servings: missing {string.Join(", ", missingList.Select(m => $"{m.Shortfall}{m.Unit} {m.ProductName}"))}.",
                    recipe.Id,
                    request.Servings,
                    missingList);
            }

            // Атомарне списання за принципом FEFO (найстаріші партії списуються першими)
            var deductedBatches = new List<CookedBatchDeduction>();

            foreach (var (productId, (requiredQty, unit, name, product)) in requiredPerProduct)
            {
                decimal remainingToDeduct = requiredQty;

                var batches = await db.InventoryItems
                    .Where(i => i.HouseholdId == request.HouseholdId && i.ProductId == productId && i.Quantity > 0)
                    .OrderBy(i => i.ExpiresAt)
                    .ThenBy(i => i.CreatedAt)
                    .ToListAsync(ct);

                foreach (var batch in batches)
                {
                    if (remainingToDeduct <= 0) break;

                    decimal deduct = Math.Min(batch.Quantity, remainingToDeduct);
                    batch.Quantity -= deduct;
                    batch.UpdatedAt = DateTime.UtcNow;
                    batch.Version += 1;
                    remainingToDeduct -= deduct;

                    deductedBatches.Add(new CookedBatchDeduction(
                        BatchId: batch.Id,
                        ProductName: name,
                        DeductedQuantity: deduct,
                        RemainingQuantity: batch.Quantity,
                        Unit: batch.Unit
                    ));
                }
            }

            // Створення запису прийому їжі в журналі MealLog
            decimal mealCalories = Math.Round(recipe.TotalCalories * request.Servings, 1);
            decimal mealProtein = Math.Round(recipe.TotalProtein * request.Servings, 1);
            decimal mealFat = Math.Round(recipe.TotalFat * request.Servings, 1);
            decimal mealCarbs = Math.Round(recipe.TotalCarbs * request.Servings, 1);

            var mealLogId = Guid.NewGuid();
            var mealLog = new MealLog
            {
                Id = mealLogId,
                UserId = userId,
                MealType = request.MealType,
                LoggedAt = DateTime.UtcNow,
                Calories = mealCalories,
                Protein = mealProtein,
                Fat = mealFat,
                Carbs = mealCarbs,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var (productId, (requiredQty, unit, name, product)) in requiredPerProduct)
            {
                decimal ratio = unit.Equals("pcs", StringComparison.OrdinalIgnoreCase)
                    ? requiredQty
                    : requiredQty / 100.0m;

                mealLog.Items.Add(new MealLogItem
                {
                    Id = Guid.NewGuid(),
                    MealLogId = mealLogId,
                    ProductId = productId,
                    Quantity = requiredQty,
                    Unit = unit,
                    Calories = Math.Round(product.CaloriesPer100g * ratio, 1),
                    Protein = Math.Round(product.ProteinPer100g * ratio, 1),
                    Fat = Math.Round(product.FatPer100g * ratio, 1),
                    Carbs = Math.Round(product.CarbsPer100g * ratio, 1)
                });
            }

            db.MealLogs.Add(mealLog);
            await db.SaveChangesAsync(ct);

            var response = new CookRecipeResponse(
                RecipeId: recipe.Id,
                MealLogId: mealLogId,
                ServingsCooked: request.Servings,
                DeductedBatches: deductedBatches,
                LoggedMacros: new MacroBudgetValues(mealCalories, mealProtein, mealFat, mealCarbs)
            );

            return Results.Ok(response);
        })
        .WithName("CookRecipe")
        .WithSummary("Атомарне приготування страви (1-Click Cook: FEFO списання + MealLog)");

        return endpoints;
    }
}
