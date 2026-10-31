namespace Ediens.Api.Entities;

/// <summary>
/// Повідомлення черги Transactional Outbox для асинхронної обробки доменних подій.
/// </summary>
public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = "{}"; // JSONB representation
    public string Status { get; set; } = "PENDING"; // "PENDING", "PROCESSED", "FAILED"
    public int RetryCount { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}
