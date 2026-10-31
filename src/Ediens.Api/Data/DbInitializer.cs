using Ediens.Api.Entities;
using Ediens.Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Data;

/// <summary>
/// Ініціалізатор схеми та базових даних платформи ēdiens у PostgreSQL.
/// Забезпечує фізичне наповнення таблиць продуктами, рецептами, цільовими нормами КБЖВ
/// та складськими запасами при першому старті.
/// </summary>
public static class DbInitializer
{
    public static async Task SeedAsync(EdiensDbContext db)
    {
        // Делегуємо до єдиного джерела демо-даних платформи
        await DatabaseSeeder.SeedAsync(db);
    }
}
