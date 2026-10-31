namespace Ediens.Api.Entities;

/// <summary>
/// Продукт харчування з харчовою цінністю (КБЖВ на 100г).
/// </summary>
public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Barcode { get; set; } // EAN-13, nullable
    public string? Brand { get; set; }
    public decimal CaloriesPer100g { get; set; }
    public decimal ProteinPer100g { get; set; }
    public decimal FatPer100g { get; set; }
    public decimal CarbsPer100g { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Навігаційні властивості
    public ICollection<InventoryItem> InventoryItems { get; set; } = new List<InventoryItem>();
    public ICollection<RecipeIngredient> RecipeIngredients { get; set; } = new List<RecipeIngredient>();
    public ICollection<MealLogItem> MealLogItems { get; set; } = new List<MealLogItem>();
    public ICollection<ShoppingListItem> ShoppingListItems { get; set; } = new List<ShoppingListItem>();
}
