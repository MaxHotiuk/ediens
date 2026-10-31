using Ediens.Api.Data;
using Ediens.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ediens.Api.Features.Common;

/// <summary>
/// Ініціалізатор базових демо-даних платформи ēdiens.
/// </summary>
public static class DatabaseSeeder
{
    public static readonly Guid OlegUserId = Guid.Parse("0192e2b0-0000-7000-8000-000000000001");
    public static readonly Guid AnnaUserId = Guid.Parse("0192e2b0-0000-7000-8000-000000000002");
    public static readonly Guid StrangerUserId = Guid.Parse("0192e2b0-0000-7000-8000-000000000099");

    public static readonly Guid MainHouseholdId = Guid.Parse("0192e2b0-8812-7001-9011-aa9988776655");
    public static readonly Guid StrangerHouseholdId = Guid.Parse("0192e2b0-8812-7001-9011-bb0000000099");

    public static readonly Guid MilkProductId = Guid.Parse("0192e2b1-0000-7000-8000-000000000001");
    public static readonly Guid ChickenProductId = Guid.Parse("0192e2b1-0000-7000-8000-000000000002");
    public static readonly Guid OatmealProductId = Guid.Parse("0192e2b1-0000-7000-8000-000000000005");
    public static readonly Guid SpinachProductId = Guid.Parse("0192e2b1-0000-7000-8000-000000000007");
    public static readonly Guid BuckwheatProductId = Guid.Parse("0192e2b1-0000-7000-8000-000000000008");

    public static readonly Guid ChickenDinnerRecipeId = Guid.Parse("0192e2b8-1234-7111-9988-bbccddeeff00");

    public static async Task SeedAsync(EdiensDbContext db)
    {
        // 1. Користувачі
        if (!await db.Users.AnyAsync(u => u.Id == OlegUserId))
        {
            db.Users.AddRange(
                new User
                {
                    Id = OlegUserId,
                    Email = "oleg@ediens.app",
                    PasswordHash = "hash_oleg_demo",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new User
                {
                    Id = AnnaUserId,
                    Email = "anna@ediens.app",
                    PasswordHash = "hash_anna_demo",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new User
                {
                    Id = StrangerUserId,
                    Email = "stranger@ediens.app",
                    PasswordHash = "hash_stranger_demo",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
            await db.SaveChangesAsync();
        }

        // 2. Домогосподарства
        if (!await db.Households.AnyAsync(h => h.Id == MainHouseholdId))
        {
            db.Households.AddRange(
                new Household
                {
                    Id = MainHouseholdId,
                    Name = "Сім'я Олега та Анни",
                    InviteCode = "EDIENS-77",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Household
                {
                    Id = StrangerHouseholdId,
                    Name = "Чуже домогосподарство",
                    InviteCode = "STRANGER-99",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
            await db.SaveChangesAsync();
        }

        // 3. Члени домогосподарств
        if (!await db.HouseholdMembers.AnyAsync(m => m.HouseholdId == MainHouseholdId && m.UserId == OlegUserId))
        {
            db.HouseholdMembers.AddRange(
                new HouseholdMember
                {
                    HouseholdId = MainHouseholdId,
                    UserId = OlegUserId,
                    Role = "Owner",
                    JoinedAt = DateTime.UtcNow
                },
                new HouseholdMember
                {
                    HouseholdId = MainHouseholdId,
                    UserId = AnnaUserId,
                    Role = "Member",
                    JoinedAt = DateTime.UtcNow
                },
                new HouseholdMember
                {
                    HouseholdId = StrangerHouseholdId,
                    UserId = StrangerUserId,
                    Role = "Owner",
                    JoinedAt = DateTime.UtcNow
                }
            );
            await db.SaveChangesAsync();
        }

        // 4. Продукти
        if (!await db.Products.AnyAsync(p => p.Id == MilkProductId))
        {
            db.Products.AddRange(
                new Product
                {
                    Id = MilkProductId,
                    Name = "Молоко 'Селянське' 2.5%",
                    Barcode = "4820000112233",
                    Brand = "Яготинське",
                    CaloriesPer100g = 54.0m,
                    ProteinPer100g = 2.8m,
                    FatPer100g = 2.5m,
                    CarbsPer100g = 4.7m,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Id = ChickenProductId,
                    Name = "Куряче філе охолоджене",
                    Barcode = "4820000112244",
                    Brand = "Наша Ряба",
                    CaloriesPer100g = 110.0m,
                    ProteinPer100g = 23.5m,
                    FatPer100g = 1.2m,
                    CarbsPer100g = 0.0m,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Id = OatmealProductId,
                    Name = "Вівсяні пластівці 'Ніжні'",
                    Barcode = "4820000112255",
                    Brand = "Ніжні",
                    CaloriesPer100g = 350.0m,
                    ProteinPer100g = 12.0m,
                    FatPer100g = 6.0m,
                    CarbsPer100g = 62.0m,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Id = SpinachProductId,
                    Name = "Шпинат свіжий 'Верес'",
                    Barcode = "4820000112277",
                    Brand = "Верес",
                    CaloriesPer100g = 23.0m,
                    ProteinPer100g = 2.9m,
                    FatPer100g = 0.4m,
                    CarbsPer100g = 3.6m,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Id = BuckwheatProductId,
                    Name = "Гречана крупа",
                    Barcode = "4820000112288",
                    Brand = "Хуторок",
                    CaloriesPer100g = 330.0m,
                    ProteinPer100g = 12.5m,
                    FatPer100g = 3.3m,
                    CarbsPer100g = 62.0m,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
            await db.SaveChangesAsync();
        }

        // 5. Рецепти та інгредієнти
        if (!await db.Recipes.AnyAsync(r => r.Id == ChickenDinnerRecipeId))
        {
            var recipe = new Recipe
            {
                Id = ChickenDinnerRecipeId,
                Title = "Куряче філе з гречкою та шпинатом",
                Description = "Високобілкова вечеря зі свіжим шпинатом та філе.",
                Instructions = "1. Відварити гречану крупу до готовності. 2. Обсмажити куряче філе на сковороді. 3. Додати свіжий шпинат на 2 хвилини.",
                TotalCalories = 520.0m,
                TotalProtein = 58.0m,
                TotalFat = 8.5m,
                TotalCarbs = 48.0m,
                PrepTimeMinutes = 25,
                HouseholdId = null, // Загальнодоступний глобальний рецепт
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            db.Recipes.Add(recipe);
            await db.SaveChangesAsync();

            db.RecipeIngredients.AddRange(
                new RecipeIngredient
                {
                    Id = Guid.NewGuid(),
                    RecipeId = ChickenDinnerRecipeId,
                    ProductId = ChickenProductId,
                    Quantity = 200.0m,
                    Unit = "g",
                    IsOptional = false
                },
                new RecipeIngredient
                {
                    Id = Guid.NewGuid(),
                    RecipeId = ChickenDinnerRecipeId,
                    ProductId = SpinachProductId,
                    Quantity = 50.0m,
                    Unit = "g",
                    IsOptional = false
                },
                new RecipeIngredient
                {
                    Id = Guid.NewGuid(),
                    RecipeId = ChickenDinnerRecipeId,
                    ProductId = BuckwheatProductId,
                    Quantity = 80.0m,
                    Unit = "g",
                    IsOptional = false
                }
            );
            await db.SaveChangesAsync();
        }

        // 6. Цільові норми КБЖВ
        if (!await db.NutritionTargets.AnyAsync(t => t.UserId == OlegUserId))
        {
            db.NutritionTargets.Add(new NutritionTarget
            {
                Id = Guid.NewGuid(),
                UserId = OlegUserId,
                TargetCalories = 2200.0m,
                TargetProtein = 160.0m,
                TargetFat = 65.0m,
                TargetCarbs = 240.0m,
                EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
    }
}
