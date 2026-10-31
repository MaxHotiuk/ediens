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

        // 5. POST /api/v1/households/{id}/shopping-list/transfer-to-inventory
        group.MapPost("/transfer-to-inventory", async (
            Guid id,
            TransferShoppingListToInventoryRequest? request,
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

            var isRelational = db.Database.IsRelational();
            await using var tx = isRelational ? await db.Database.BeginTransactionAsync(ct) : null;

            try
            {
                List<ShoppingListItem> itemsToTransfer;
                if (request?.Items != null && request.Items.Count > 0)
                {
                    var requestedIds = request.Items.Select(i => i.ItemId).ToList();
                    itemsToTransfer = await db.ShoppingListItems
                        .Include(s => s.Product)
                        .Where(s => s.HouseholdId == id && requestedIds.Contains(s.Id))
                        .ToListAsync(ct);
                }
                else
                {
                    itemsToTransfer = await db.ShoppingListItems
                        .Include(s => s.Product)
                        .Where(s => s.HouseholdId == id && s.IsPurchased)
                        .ToListAsync(ct);
                }

                if (itemsToTransfer.Count == 0)
                {
                    return Results.Ok(new TransferShoppingListResponse(
                        0,
                        new List<TransferredInventoryItemSummary>(),
                        "No items found for inventory transfer."
                    ));
                }

                var overridesMap = request?.Items?.ToDictionary(i => i.ItemId) 
                    ?? new Dictionary<Guid, TransferShoppingListItemRequest>();
                var validLocations = new[] { "Fridge", "Freezer", "Pantry" };
                var transferredSummaries = new List<TransferredInventoryItemSummary>();

                foreach (var sItem in itemsToTransfer)
                {
                    overridesMap.TryGetValue(sItem.Id, out var itemOverride);

                    var smart = ProductSmartClassifier.GetDefaults(sItem.ProductName);

                    var location = itemOverride?.Location;
                    if (string.IsNullOrWhiteSpace(location) || !validLocations.Contains(location, StringComparer.OrdinalIgnoreCase))
                    {
                        location = smart.Location;
                    }

                    DateTime expiresAt;
                    if (itemOverride?.ExpiresAt.HasValue == true && itemOverride.ExpiresAt.Value > DateTime.MinValue)
                    {
                        expiresAt = itemOverride.ExpiresAt.Value.ToUniversalTime();
                    }
                    else
                    {
                        expiresAt = DateTime.UtcNow.Date.AddDays(smart.ShelfLifeDays);
                    }

                    var quantity = itemOverride?.Quantity ?? sItem.Quantity;
                    if (quantity <= 0) quantity = sItem.Quantity > 0 ? sItem.Quantity : 1;

                    var unit = !string.IsNullOrWhiteSpace(itemOverride?.Unit) ? itemOverride.Unit : sItem.Unit;
                    if (string.IsNullOrWhiteSpace(unit)) unit = "pcs";

                    // Ensure product exists
                    Product? product = sItem.Product;
                    if (product == null && sItem.ProductId.HasValue)
                    {
                        product = await db.Products.FindAsync(new object[] { sItem.ProductId.Value }, ct);
                    }
                    if (product == null)
                    {
                        product = await db.Products.FirstOrDefaultAsync(
                            p => p.Name.ToLower() == sItem.ProductName.ToLower(), ct);
                    }
                    if (product == null)
                    {
                        product = new Product
                        {
                            Id = Guid.NewGuid(),
                            Name = sItem.ProductName.Trim(),
                            CaloriesPer100g = 100m,
                            ProteinPer100g = 5m,
                            FatPer100g = 3m,
                            CarbsPer100g = 15m,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        db.Products.Add(product);
                        await db.SaveChangesAsync(ct);
                    }

                    var inventoryItem = new InventoryItem
                    {
                        Id = Guid.NewGuid(),
                        HouseholdId = id,
                        ProductId = product.Id,
                        Product = product,
                        Location = location,
                        Quantity = quantity,
                        Unit = unit,
                        ExpiresAt = expiresAt,
                        OpenedAt = null,
                        Version = 1,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    db.InventoryItems.Add(inventoryItem);
                    db.ShoppingListItems.Remove(sItem);

                    transferredSummaries.Add(new TransferredInventoryItemSummary(
                        inventoryItem.Id,
                        product.Id,
                        product.Name,
                        inventoryItem.Location,
                        inventoryItem.Quantity,
                        inventoryItem.Unit,
                        inventoryItem.ExpiresAt
                    ));
                }

                await db.SaveChangesAsync(ct);

                if (tx != null)
                {
                    await tx.CommitAsync(ct);
                }

                return Results.Ok(new TransferShoppingListResponse(
                    transferredSummaries.Count,
                    transferredSummaries,
                    $"Successfully transferred {transferredSummaries.Count} item(s) to inventory."
                ));
            }
            catch
            {
                if (tx != null)
                {
                    await tx.RollbackAsync(ct);
                }
                throw;
            }
        })
        .WithName("TransferShoppingListToInventory")
        .WithSummary("Атомарно перенести куплені товари зі списку покупок в інвентар домогосподарства");

        // Map Households endpoint
        endpoints.MapHouseholdEndpoints();

        return endpoints;
    }
}
