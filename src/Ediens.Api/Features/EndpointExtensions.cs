using Ediens.Api.Features.Inventory;
using Ediens.Api.Features.Meals;
using Ediens.Api.Features.Nutrition;
using Ediens.Api.Features.Products;
using Ediens.Api.Features.Recipes;
using Ediens.Api.Features.ShoppingList;
using Microsoft.AspNetCore.Builder;

namespace Ediens.Api.Features;

/// <summary>
/// Реєстрація всіх вертикальних слайсів та REST-ендпоінтів платформи ēdiens.
/// </summary>
public static class EndpointExtensions
{
    public static WebApplication MapEdiensEndpoints(this WebApplication app)
    {
        app.MapInventoryEndpoints();
        app.MapMealEndpoints();
        app.MapNutritionEndpoints();
        app.MapRecipeEndpoints();
        app.MapProductEndpoints();
        app.MapShoppingListEndpoints();

        return app;
    }
}
