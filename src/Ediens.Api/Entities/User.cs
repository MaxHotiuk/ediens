namespace Ediens.Api.Entities;

/// <summary>
/// Обліковий запис користувача платформи ēdiens.
/// </summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Навігаційні властивості
    public ICollection<HouseholdMember> HouseholdMembers { get; set; } = new List<HouseholdMember>();
    public ICollection<NutritionTarget> NutritionTargets { get; set; } = new List<NutritionTarget>();
    public ICollection<MealLog> MealLogs { get; set; } = new List<MealLog>();
    public ICollection<ShoppingListItem> ShoppingListItems { get; set; } = new List<ShoppingListItem>();
    public ICollection<IdempotencyRecord> IdempotencyRecords { get; set; } = new List<IdempotencyRecord>();
}
