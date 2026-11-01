using System.Text.Json;
using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Entities;
using Ediens.Api.Features.Common;
using Ediens.Api.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Inventory;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/inventory/items")
            .WithTags("Inventory");

        // 1. POST /api/v1/inventory/items
        group.MapPost("", async (
            CreateInventoryItemRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            // Валідація полів
            if (request.Quantity <= 0 ||
                string.IsNullOrWhiteSpace(request.ProductName) ||
                request.ProductName.Trim().Length < 2)
            {
                var errors = new Dictionary<string, string[]>();
                if (request.Quantity <= 0) errors["quantity"] = new[] { "Quantity must be greater than 0." };
                if (string.IsNullOrWhiteSpace(request.ProductName) || request.ProductName.Trim().Length < 2)
                    errors["productName"] = new[] { "ProductName must have at least 2 characters." };

                return EdiensResults.ValidationProblem(context.Request.Path, errors: errors);
            }

            var validLocations = new[] { "Fridge", "Freezer", "Pantry" };
            if (!validLocations.Contains(request.Location, StringComparer.OrdinalIgnoreCase))
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    errors: new Dictionary<string, string[]>
                    {
                        ["location"] = new[] { $"Location '{request.Location}' is invalid. Permitted: Fridge, Freezer, Pantry." }
                    });
            }

            var validUnits = new[] { "g", "ml", "pcs" };
            if (!validUnits.Contains(request.Unit, StringComparer.OrdinalIgnoreCase))
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    errors: new Dictionary<string, string[]>
                    {
                        ["unit"] = new[] { $"Unit '{request.Unit}' is invalid. Permitted: 'g', 'ml', 'pcs'." }
                    });
            }

            // Перевірка доступу до домогосподарства
            if (!await HouseholdAccessValidator.IsMemberAsync(db, request.HouseholdId, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{request.HouseholdId}'.",
                    householdId: request.HouseholdId);
            }

            // Пошук або реєстрація продукту
            Guid productId;
            Product? product = null;
            if (request.ProductId.HasValue)
            {
                product = await db.Products.FindAsync(new object[] { request.ProductId.Value }, ct);
            }

            if (product == null)
            {
                product = await db.Products.FirstOrDefaultAsync(
                    p => p.Name.ToLower() == request.ProductName.ToLower(), ct);
            }

            if (product == null)
            {
                product = new Product
                {
                    Id = Guid.NewGuid(),
                    Name = request.ProductName.Trim(),
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

            productId = product.Id;

            var item = new InventoryItem
            {
                Id = Guid.NewGuid(),
                HouseholdId = request.HouseholdId,
                ProductId = productId,
                Product = product,
                Location = request.Location,
                Quantity = request.Quantity,
                Unit = request.Unit,
                ExpiresAt = request.ExpiresAt.ToUniversalTime(),
                OpenedAt = request.OpenedAt?.ToUniversalTime(),
                Version = 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            db.InventoryItems.Add(item);
            await db.SaveChangesAsync(ct);

            var response = ToResponse(item);
            context.Response.Headers.ETag = ETagHelper.Format(item.Version);
            context.Response.Headers.Location = $"/api/v1/inventory/items/{item.Id}";

            return Results.Created($"/api/v1/inventory/items/{item.Id}", response);
        })
        .WithName("AddInventoryItem")
        .WithSummary("Додати партію продукту в інвентар домогосподарства");

        // 2. GET /api/v1/inventory/items
        group.MapGet("", async (
            Guid householdId,
            string? location,
            string? status,
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

            var query = db.InventoryItems
                .Include(i => i.Product)
                .Where(i => i.HouseholdId == householdId && i.Quantity > 0);

            if (!string.IsNullOrWhiteSpace(location))
            {
                query = query.Where(i => i.Location == location);
            }

            // Сортування FEFO: найперші за терміном придатності
            var items = await query
                .OrderBy(i => i.ExpiresAt)
                .ThenBy(i => i.CreatedAt)
                .ToListAsync(ct);

            var responses = items.Select(ToResponse).ToList();

            if (!string.IsNullOrWhiteSpace(status))
            {
                responses = responses
                    .Where(r => string.Equals(r.FreshnessStatus, status, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            return Results.Ok(new InventoryItemListResponse(householdId, responses.Count, responses));
        })
        .WithName("GetInventoryItems")
        .WithSummary("Отримати перелік запасів за FEFO");

        // 3. GET /api/v1/inventory/items/{id}
        group.MapGet("/{id:guid}", async (
            Guid id,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var item = await db.InventoryItems
                .Include(i => i.Product)
                .FirstOrDefaultAsync(i => i.Id == id, ct);

            if (item == null)
            {
                return EdiensResults.NotFound(
                    context.Request.Path,
                    $"Inventory batch '{id}' could not be found in active household inventory.",
                    resourceType: "InventoryBatch",
                    resourceId: id.ToString());
            }

            if (!await HouseholdAccessValidator.IsMemberAsync(db, item.HouseholdId, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{item.HouseholdId}'.",
                    householdId: item.HouseholdId);
            }

            context.Response.Headers.ETag = ETagHelper.Format(item.Version);
            return Results.Ok(ToResponse(item));
        })
        .WithName("GetInventoryItemById")
        .WithSummary("Отримати детальну інформацію про конкретну партію");

        // 4. PATCH /api/v1/inventory/items/{id}
        group.MapPatch("/{id:guid}", async (
            Guid id,
            UpdateInventoryItemRequest request,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var item = await db.InventoryItems
                .Include(i => i.Product)
                .FirstOrDefaultAsync(i => i.Id == id, ct);

            if (item == null)
            {
                return EdiensResults.NotFound(
                    context.Request.Path,
                    $"Inventory batch '{id}' could not be found in active household inventory.",
                    resourceType: "InventoryBatch",
                    resourceId: id.ToString());
            }

            if (!await HouseholdAccessValidator.IsMemberAsync(db, item.HouseholdId, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{item.HouseholdId}'.",
                    householdId: item.HouseholdId);
            }

            // Перевірка If-Match для оптимістичного блокування
            context.Request.Headers.TryGetValue("If-Match", out var ifMatchHeaders);
            var ifMatch = ifMatchHeaders.FirstOrDefault();
            var clientVersion = ETagHelper.Parse(ifMatch);

            if (!clientVersion.HasValue || clientVersion.Value != item.Version)
            {
                context.Response.Headers.ETag = ETagHelper.Format(item.Version);
                return EdiensResults.ConcurrentModification(
                    context.Request.Path,
                    "The inventory item has been modified by another household member since you loaded it.",
                    ETagHelper.Format(item.Version),
                    item.Quantity,
                    item.Unit,
                    clientExpectedETag: ifMatch,
                    productName: item.Product?.Name ?? "Item",
                    lastModifiedBy: "HouseholdMember",
                    lastModifiedAt: item.UpdatedAt);
            }

            // Валідація локації, якщо передано
            if (!string.IsNullOrWhiteSpace(request.Location))
            {
                var validLocations = new[] { "Fridge", "Freezer", "Pantry" };
                if (!validLocations.Contains(request.Location, StringComparer.OrdinalIgnoreCase))
                {
                    return EdiensResults.ValidationProblem(
                        context.Request.Path,
                        errors: new Dictionary<string, string[]>
                        {
                            ["location"] = new[] { $"Location '{request.Location}' is invalid. Permitted: Fridge, Freezer, Pantry." }
                        });
                }
                item.Location = validLocations.First(l => string.Equals(l, request.Location, StringComparison.OrdinalIgnoreCase));
            }

            // Оновлення терміну придатності, якщо передано
            if (request.ExpiresAt.HasValue)
            {
                item.ExpiresAt = request.ExpiresAt.Value.ToUniversalTime();
            }

            // Розрахунок нової кількості (підтримка як quantity, так і quantityDelta)
            decimal newQuantity;
            if (request.Quantity.HasValue)
            {
                newQuantity = request.Quantity.Value;
            }
            else if (request.QuantityDelta.HasValue)
            {
                newQuantity = item.Quantity + request.QuantityDelta.Value;
            }
            else
            {
                newQuantity = item.Quantity;
            }

            // Перевірка інваріанту: невід'ємний залишок
            if (newQuantity < 0)
            {
                var requestedDeduction = request.QuantityDelta.HasValue
                    ? Math.Abs(request.QuantityDelta.Value)
                    : Math.Abs(newQuantity - item.Quantity);

                return EdiensResults.ProblemDetails(
                    StatusCodes.Status422UnprocessableEntity,
                    "Inventory stock insufficient to complete requested action.",
                    $"Cannot deduct {requestedDeduction} {item.Unit}: available quantity is only {item.Quantity} {item.Unit}.",
                    ErrorCodes.InsufficientInventory,
                    context.Request.Path,
                    new
                    {
                        currentQuantity = item.Quantity,
                        requestedDeduction = requestedDeduction,
                        unit = item.Unit
                    });
            }

            item.Quantity = newQuantity;
            if (request.MarkOpened && item.OpenedAt == null)
            {
                item.OpenedAt = DateTime.UtcNow;
            }
            item.UpdatedAt = DateTime.UtcNow;
            item.Version += 1; // Оновлюємо concurrency token

            // Автоматичне очищення / видалення партії при нульовому залишку
            if (newQuantity == 0)
            {
                db.InventoryItems.Remove(item);
            }

            await db.SaveChangesAsync(ct);

            context.Response.Headers.ETag = ETagHelper.Format(item.Version);
            return Results.Ok(ToResponse(item));
        })
        .WithName("UpdateInventoryItem")
        .WithSummary("Змінити партію (локація, термін придатності, кількість) або списати частину партії (If-Match ETag)");

        // 5. DELETE /api/v1/inventory/items/{id}
        group.MapDelete("/{id:guid}", async (
            Guid id,
            string? reason,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            var userId = UserContext.GetCurrentUserId(context);

            var item = await db.InventoryItems
                .Include(i => i.Product)
                .FirstOrDefaultAsync(i => i.Id == id, ct);

            if (item == null)
            {
                return EdiensResults.NotFound(
                    context.Request.Path,
                    $"Inventory batch '{id}' could not be found in active household inventory.",
                    resourceType: "InventoryBatch",
                    resourceId: id.ToString());
            }

            if (!await HouseholdAccessValidator.IsMemberAsync(db, item.HouseholdId, userId, ct))
            {
                return EdiensResults.Forbidden(
                    context.Request.Path,
                    $"The authenticated user is not a registered member of household '{item.HouseholdId}'.",
                    householdId: item.HouseholdId);
            }

            var deleteReason = string.IsNullOrWhiteSpace(reason) ? "SPOILED" : reason;
            if (deleteReason.Equals("SPOILED", StringComparison.OrdinalIgnoreCase))
            {
                db.OutboxMessages.Add(new OutboxMessage
                {
                    Id = Guid.NewGuid(),
                    EventType = "InventoryItemSpoiled",
                    Payload = JsonSerializer.Serialize(new
                    {
                        itemId = item.Id,
                        householdId = item.HouseholdId,
                        productName = item.Product?.Name,
                        quantity = item.Quantity,
                        unit = item.Unit,
                        spoiledAt = DateTime.UtcNow
                    }),
                    Status = "PENDING",
                    CreatedAt = DateTime.UtcNow
                });
            }

            db.InventoryItems.Remove(item);
            await db.SaveChangesAsync(ct);

            return Results.NoContent();
        })
        .WithName("DeleteInventoryItem")
        .WithSummary("Видалити партію продукту");

        return endpoints;
    }

    private static (string status, int days) CalculateFreshness(DateTime expiresAt)
    {
        var now = DateTime.UtcNow;
        var days = (int)Math.Ceiling((expiresAt - now).TotalDays);

        if (expiresAt < now) return ("EXPIRED", days);
        if ((expiresAt - now).TotalHours <= 24) return ("CRITICAL", days);
        if (days <= 3) return ("EXPIRING_SOON", days);
        return ("FRESH", days);
    }

    private static InventoryItemResponse ToResponse(InventoryItem item)
    {
        var (status, days) = CalculateFreshness(item.ExpiresAt);
        return new InventoryItemResponse(
            item.Id,
            item.HouseholdId,
            item.ProductId,
            item.Product?.Name ?? "Item",
            item.Location,
            item.Quantity,
            item.Unit,
            item.ExpiresAt,
            item.OpenedAt,
            ETagHelper.Format(item.Version),
            status,
            days,
            item.CreatedAt
        );
    }
}
