namespace Ediens.Api.Middleware;

/// <summary>
/// Допоміжний клас для генерації та валідації HTTP-заголовків ETag та If-Match на основі PostgreSQL xmin.
/// </summary>
public static class ETagHelper
{
    public static string Format(uint xmin) => $"W/\"{xmin}\"";

    public static uint? Parse(string? etag)
    {
        if (string.IsNullOrWhiteSpace(etag)) return null;

        var clean = etag.Trim();
        if (clean.StartsWith("W/\"", StringComparison.OrdinalIgnoreCase) && clean.EndsWith("\""))
        {
            clean = clean[3..^1];
        }
        else if (clean.StartsWith("\"") && clean.EndsWith("\""))
        {
            clean = clean[1..^1];
        }

        return uint.TryParse(clean, out var val) ? val : null;
    }
}
