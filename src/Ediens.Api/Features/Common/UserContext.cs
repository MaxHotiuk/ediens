using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Ediens.Api.Features.Common;

/// <summary>
/// Допоміжний клас для отримання контексту автентифікованого користувача.
/// Підтримує JWT Claims, заголовок X-User-Id та fallback на системного користувача Олега.
/// </summary>
public static class UserContext
{
    public static readonly Guid DefaultUserId = Guid.Parse("0192e2b0-0000-7000-8000-000000000001");

    public static Guid GetCurrentUserId(HttpContext context)
    {
        // 1. Перевірка прямого заголовка X-User-Id (для тестових викликів та інтеграцій)
        if (context.Request.Headers.TryGetValue("X-User-Id", out var customUserId) &&
            Guid.TryParse(customUserId.FirstOrDefault(), out var headerGuid))
        {
            return headerGuid;
        }

        // 2. Перевірка JWT Claims
        var subClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? context.User.FindFirst("sub")?.Value;

        if (Guid.TryParse(subClaim, out var claimGuid))
        {
            return claimGuid;
        }

        return DefaultUserId;
    }
}
