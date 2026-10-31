namespace Ediens.Api.Entities;

/// <summary>
/// Реєстр виконаних ідемпотентних мутацій для захисту від повторних викликів клієнта.
/// </summary>
public class IdempotencyRecord
{
    public string IdempotencyKey { get; set; } = string.Empty;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string RequestPath { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string ResponseBody { get; set; } = "{}"; // JSONB
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);
}
