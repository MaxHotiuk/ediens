using Ediens.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ediens.Api.Data;

/// <summary>
/// Головний контекст бази даних платформи ēdiens для PostgreSQL 17+.
/// </summary>
public class EdiensDbContext : DbContext
{
    public EdiensDbContext(DbContextOptions<EdiensDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Household> Households => Set<Household>();
    public DbSet<HouseholdMember> HouseholdMembers => Set<HouseholdMember>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<NutritionTarget> NutritionTargets => Set<NutritionTarget>();
    public DbSet<MealLog> MealLogs => Set<MealLog>();
    public DbSet<MealLogItem> MealLogItems => Set<MealLogItem>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();
    public DbSet<ShoppingListItem> ShoppingListItems => Set<ShoppingListItem>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(EdiensDbContext).Assembly);
    }
}
