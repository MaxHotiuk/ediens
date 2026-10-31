namespace Ediens.Api.Entities;

/// <summary>
/// Спільний список покупок домогосподарства з підтримкою векторних версій для офлайн-синхронізації.
/// </summary>
public class ShoppingListItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HouseholdId { get; set; }
    public Household Household { get; set; } = null!;

    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g"; // "g", "ml", "pcs"
    public bool IsPurchased { get; set; }

    public Guid? AddedByUserId { get; set; }
    public User? AddedByUser { get; set; }

    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    public long Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
