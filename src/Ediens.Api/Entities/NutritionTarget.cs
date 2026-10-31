namespace Ediens.Api.Entities;

/// <summary>
/// Цільовий добовий профіль макронутрієнтів (КБЖВ) користувача.
/// </summary>
public class NutritionTarget
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public decimal TargetCalories { get; set; }
    public decimal TargetProtein { get; set; }
    public decimal TargetFat { get; set; }
    public decimal TargetCarbs { get; set; }
    public DateOnly EffectiveFrom { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
