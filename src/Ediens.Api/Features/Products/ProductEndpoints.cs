using System.Text.RegularExpressions;
using Ediens.Api.Common.Errors;
using Ediens.Api.Data;
using Ediens.Api.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Products;

public static partial class ProductEndpoints
{
    [GeneratedRegex(@"^\d{8,13}$")]
    private static partial Regex BarcodeRegex();

    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/products")
            .WithTags("Products");

        group.MapGet("/barcode/{code}", async (
            string code,
            HttpContext context,
            EdiensDbContext db,
            CancellationToken ct) =>
        {
            // Валідація формату EAN-8 / EAN-13 (лише цифри, довжина 8–13)
            if (string.IsNullOrWhiteSpace(code) || !BarcodeRegex().IsMatch(code.Trim()))
            {
                return EdiensResults.ValidationProblem(
                    context.Request.Path,
                    errors: new Dictionary<string, string[]>
                    {
                        ["code"] = new[] { "Barcode must contain between 8 and 13 digits (EAN-8 or EAN-13 standard)." }
                    },
                    invalidParams: new List<InvalidParamItem>
                    {
                        new() { Name = "code", Reason = "Must match pattern ^\\d{8,13}$", Value = code }
                    });
            }

            var cleanCode = code.Trim();

            // 1. Пошук у локальній базі даних
            var product = await db.Products
                .FirstOrDefaultAsync(p => p.Barcode == cleanCode, ct);

            if (product != null)
            {
                return Results.Ok(new ProductBarcodeDetailsResponse(
                    Barcode: product.Barcode ?? cleanCode,
                    Name: product.Name,
                    Brand: product.Brand,
                    CaloriesPer100g: product.CaloriesPer100g,
                    ProteinPer100g: product.ProteinPer100g,
                    FatPer100g: product.FatPer100g,
                    CarbsPer100g: product.CarbsPer100g,
                    DataSource: "LocalDatabase",
                    IsCached: true
                ));
            }

            // 2. Імітація інтеграції з каталогом Open Food Facts для невідомих зовнішніх штрих-кодів
            if (cleanCode.StartsWith("482")) // Префікс України
            {
                var externalResponse = new ProductBarcodeDetailsResponse(
                    Barcode: cleanCode,
                    Name: $"Продукт {cleanCode}",
                    Brand: "Український виробник",
                    CaloriesPer100g: 125.0m,
                    ProteinPer100g: 7.5m,
                    FatPer100g: 4.2m,
                    CarbsPer100g: 14.8m,
                    DataSource: "OpenFoodFacts",
                    IsCached: false
                );

                return Results.Ok(externalResponse);
            }

            return EdiensResults.NotFound(
                context.Request.Path,
                $"Product with barcode '{cleanCode}' was not found in catalog.",
                resourceType: "Product",
                resourceId: cleanCode);
        })
        .RequireRateLimiting(RateLimiterExtensions.BarcodePolicyName)
        .WithName("GetProductByBarcode")
        .WithSummary("Пошук назви та КБЖВ продукту за штрих-кодом EAN-13");

        return endpoints;
    }
}
