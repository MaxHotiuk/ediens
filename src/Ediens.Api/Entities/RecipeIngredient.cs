namespace Ediens.Api.Entities;

/// <summary>
/// Компонентний склад рецепта із зазначенням необхідної кількості.
/// </summary>
public class RecipeIngredient
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g"; // "g", "ml", "pcs"
    public bool IsOptional { get; set; }
}
