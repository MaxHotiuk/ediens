namespace Ediens.Api.Entities;

/// <summary>
/// Членство користувача в домогосподарстві з роллю RBAC (Owner або Member).
/// </summary>
public class HouseholdMember
{
    public Guid HouseholdId { get; set; }
    public Household Household { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Role { get; set; } = "Member"; // "Owner" or "Member"
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
