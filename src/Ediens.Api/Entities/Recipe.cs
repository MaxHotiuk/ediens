namespace Ediens.Api.Entities;

/// <summary>
/// Каталог кулінарних рецептів (глобальних або створених домогосподарством).
/// </summary>
public class Recipe
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? HouseholdId { get; set; }
    public Household? Household { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;

    public decimal TotalCalories { get; set; }
    public decimal TotalProtein { get; set; }
    public decimal TotalFat { get; set; }
    public decimal TotalCarbs { get; set; }
    public int PrepTimeMinutes { get; set; } = 15;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Навігаційні властивості
    public ICollection<RecipeIngredient> Ingredients { get; set; } = new List<RecipeIngredient>();
}
