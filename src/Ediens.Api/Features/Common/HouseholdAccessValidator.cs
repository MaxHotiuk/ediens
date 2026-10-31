using Ediens.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Features.Common;

/// <summary>
/// Валідатор прав доступу до домогосподарства для ізоляції орендарів (Multi-Tenant Scoping).
/// </summary>
public static class HouseholdAccessValidator
{
    public static async Task<bool> IsMemberAsync(
        EdiensDbContext dbContext,
        Guid householdId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Перевіряємо, чи існує активне членство користувача у вказаному домогосподарстві
        return await dbContext.HouseholdMembers
            .AnyAsync(m => m.HouseholdId == householdId && m.UserId == userId, cancellationToken);
    }
}
