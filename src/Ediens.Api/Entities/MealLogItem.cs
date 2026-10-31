namespace Ediens.Api.Entities;

/// <summary>
/// Деталізація інгредієнтів/продуктів у конкретному прийомі їжі.
/// </summary>
public class MealLogItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid MealLogId { get; set; }
    public MealLog MealLog { get; set; } = null!;

    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "g"; // "g", "ml", "pcs"
    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Fat { get; set; }
    public decimal Carbs { get; set; }
}
