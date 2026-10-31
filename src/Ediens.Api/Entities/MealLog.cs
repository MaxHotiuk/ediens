namespace Ediens.Api.Entities;

/// <summary>
/// Щоденник фактичних прийомів їжі користувача із захистом від дублювання (IdempotencyKey).
/// </summary>
public class MealLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime LoggedAt { get; set; } = DateTime.UtcNow;
    public string MealType { get; set; } = "Breakfast"; // "Breakfast", "Lunch", "Dinner", "Snack"
    public decimal Calories { get; set; }
    public decimal Protein { get; set; }
    public decimal Fat { get; set; }
    public decimal Carbs { get; set; }

    public Guid? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навігаційні властивості
    public ICollection<MealLogItem> Items { get; set; } = new List<MealLogItem>();
}
