namespace Ediens.Api.Entities;

/// <summary>
/// Складська партія продукту в домогосподарстві (FEFO облік із токеном паралелізму xmin).
/// </summary>
public class InventoryItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid HouseholdId { get; set; }
    public Household Household { get; set; } = null!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public string Location { get; set; } = "Fridge"; // "Fridge", "Freezer", "Pantry"
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g"; // "g", "ml", "pcs"

    public DateTime ExpiresAt { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// PostgreSQL xmin системний стовпець, що використовується як concurrency token для оптимістичного блокування.
    /// </summary>
    public uint Version { get; set; }
}
