using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Households;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.ShoppingList;

public static class ShoppingListEndpoints
{
    public static IEndpointRouteBuilder MapShoppingListEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/households/{id:guid}/shopping-list")
            .WithTags("ShoppingList");

        // 1. POST /api/v1/households/{id}/shopping-list/sync
        group.MapPost("/sync", async (
            Guid id,
            ShoppingListSyncRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (!await HouseholdAccessValidator.IsMemberAsync(db, id, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{id}'.",
                    householdId: id);
            }

            if (request.ClientChanges != null)
            {
                foreach (var change in request.ClientChanges)
                {
                    if (string.IsNullOrWhiteSpace(change.ProductName) || change.Quantity <= 0)
                        continue;

                    var existing = await db.ShoppingListItems
                        .FirstOrDefaultAsync(s => s.Id == change.Id && s.HouseholdId == id, ct);

                    var clientTime = change.ClientUpdatedAt.ToUniversalTime();

                    if (existing != null)
                    {
                        // Last-Write-Wins конфліктне злиття на базі часових міток
                        if (clientTime >= existing.UpdatedAt)
                        {
                            existing.ProductName = change.ProductName.Trim();
                            existing.Quantity = change.Quantity;
                            existing.Unit = change.Unit;
                            existing.IsPurchased = change.IsPurchased;
                            existing.UpdatedAt = clientTime;
                            existing.Version += 1;
                        }
                    }
                    else
                    {
                        var newItem = new ShoppingListItem
                        {
                            Id = change.Id == Guid.Empty ? Guid.NewGuid() : change.Id,
                            HouseholdId = id,
                            ProductName = change.ProductName.Trim(),
                            Quantity = change.Quantity,
                            Unit = change.Unit,
                            IsPurchased = change.IsPurchased,
                            AddedByUserId = userId,
                            Version = 1,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = clientTime
                        };
                        db.ShoppingListItems.Add(newItem);
                    }
                }

                await db.SaveChangesAsync(ct);
            }

            var allItems = await db.ShoppingListItems
                .Where(s => s.HouseholdId == id)
                .OrderBy(s => s.IsPurchased)
                .ThenBy(s => s.ProductName)
                .ToListAsync(ct);

            var responseItems = allItems.Select(s => new ShoppingListItemResponse(
                Id: s.Id,
                ProductName: s.ProductName,
                Quantity: s.Quantity,
                Unit: s.Unit,
                IsPurchased: s.IsPurchased,
                UpdatedAt: s.UpdatedAt
            )).ToList();

            var response = new ShoppingListSyncResponse(
                HouseholdId: id,
                ServerTimestamp: DateTime.UtcNow,
                Items: responseItems
            );

            return Results.Ok(response);
        })
        .WithName("SyncShoppingList")
        .WithSummary("Синхронізувати та злити зміни спільного списку покупок");

        // 2. GET /api/v1/households/{id}/shopping-list
        group.MapGet("", async (
            Guid id,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (!await HouseholdAccessValidator.IsMemberAsync(db, id, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{id}'.",
                    householdId: id);
            }

            var allItems = await db.ShoppingListItems
                .Where(s => s.HouseholdId == id)
                .OrderBy(s => s.IsPurchased)
                .ThenBy(s => s.ProductName)
                .ToListAsync(ct);

            var responseItems = allItems.Select(s => new ShoppingListItemResponse(
                Id: s.Id,
                ProductName: s.ProductName,
                Quantity: s.Quantity,
                Unit: s.Unit,
                IsPurchased: s.IsPurchased,
                UpdatedAt: s.UpdatedAt
            )).ToList();

            var response = new ShoppingListSyncResponse(
                HouseholdId: id,
                ServerTimestamp: DateTime.UtcNow,
                Items: responseItems
            );

            return Results.Ok(response);
        })
        .WithName("GetShoppingList")
        .WithSummary("Отримати поточний список покупок домогосподарства");

        // 3. DELETE /api/v1/households/{id}/shopping-list/items/{itemId}
        group.MapDelete("/items/{itemId:guid}", async (
            Guid id,
            Guid itemId,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (!await HouseholdAccessValidator.IsMemberAsync(db, id, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{id}'.",
                    householdId: id);
            }

            var item = await db.ShoppingListItems
                .FirstOrDefaultAsync(s => s.Id == itemId && s.HouseholdId == id, ct);

            if (item != null)
            {
                db.ShoppingListItems.Remove(item);
                await db.SaveChangesAsync(ct);
            }

            return Results.NoContent();
        })
        .WithName("DeleteShoppingListItem")
        .WithSummary("Видалити товар зі списку покупок");

        // 4. DELETE /api/v1/households/{id}/shopping-list/purchased
        group.MapDelete("/purchased", async (
            Guid id,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            if (!await HouseholdAccessValidator.IsMemberAsync(db, id, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{id}'.",
                    householdId: id);
            }

            var purchasedItems = await db.ShoppingListItems
                .Where(s => s.HouseholdId == id && s.IsPurchased)
                .ToListAsync(ct);

            if (purchasedItems.Count > 0)
            {
                db.ShoppingListItems.RemoveRange(purchasedItems);
                await db.SaveChangesAsync(ct);
            }

            return Results.NoContent();
        })
        .WithName("ClearPurchasedShoppingListItems")
        .WithSummary("Очистити всі придбані товари зі списку покупок");

        // Map Households endpoint
        endpoints.MapHouseholdEndpoints();

        return endpoints;
    }
}
