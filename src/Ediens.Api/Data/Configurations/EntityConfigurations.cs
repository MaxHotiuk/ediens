using Ediens.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ediens.Api.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Email).HasMaxLength(255).IsRequired();
        builder.HasIndex(e => e.Email).IsUnique().HasDatabaseName("uq_users_email");

        builder.Property(e => e.PasswordHash).IsRequired();
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}

public class HouseholdConfiguration : IEntityTypeConfiguration<Household>
{
    public void Configure(EntityTypeBuilder<Household> builder)
    {
        builder.ToTable("households");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Name).HasMaxLength(150).IsRequired();
        builder.Property(e => e.InviteCode).HasMaxLength(16).IsRequired();
        builder.HasIndex(e => e.InviteCode).IsUnique().HasDatabaseName("uq_households_invite_code");

        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}

public class HouseholdMemberConfiguration : IEntityTypeConfiguration<HouseholdMember>
{
    public void Configure(EntityTypeBuilder<HouseholdMember> builder)
    {
        builder.ToTable("household_members");
        builder.HasKey(e => new { e.HouseholdId, e.UserId });

        builder.Property(e => e.Role).HasMaxLength(20).IsRequired();
        builder.Property(e => e.JoinedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(e => e.Household)
            .WithMany(h => h.Members)
            .HasForeignKey(e => e.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.User)
            .WithMany(u => u.HouseholdMembers)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.UserId).HasDatabaseName("idx_household_members_user");
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Name).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Barcode).HasMaxLength(13);
        builder.HasIndex(e => e.Barcode)
            .IsUnique()
            .HasFilter("barcode IS NOT NULL")
            .HasDatabaseName("idx_products_barcode");

        builder.Property(e => e.Brand).HasMaxLength(150);
        builder.Property(e => e.CaloriesPer100g).HasPrecision(7, 2).IsRequired();
        builder.Property(e => e.ProteinPer100g).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.FatPer100g).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.CarbsPer100g).HasPrecision(6, 2).IsRequired();

        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}

public class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        builder.ToTable("inventory_items");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Location).HasMaxLength(20).IsRequired();
        builder.Property(e => e.Quantity).HasPrecision(10, 2).IsRequired();
        builder.Property(e => e.Unit).HasMaxLength(10).IsRequired();
        builder.Property(e => e.ExpiresAt).IsRequired();
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        // PostgreSQL xmin Concurrency Token (RowVersion)
        builder.Property(e => e.Version).IsRowVersion();

        builder.HasOne(e => e.Household)
            .WithMany(h => h.InventoryItems)
            .HasForeignKey(e => e.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Product)
            .WithMany(p => p.InventoryItems)
            .HasForeignKey(e => e.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // FEFO partial composite index
        builder.HasIndex(e => new { e.HouseholdId, e.ExpiresAt })
            .HasFilter("quantity > 0")
            .HasDatabaseName("idx_inventory_fefo");

        builder.HasIndex(e => e.ProductId).HasDatabaseName("idx_inventory_product");
    }
}

public class NutritionTargetConfiguration : IEntityTypeConfiguration<NutritionTarget>
{
    public void Configure(EntityTypeBuilder<NutritionTarget> builder)
    {
        builder.ToTable("nutrition_targets");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.TargetCalories).HasPrecision(7, 2).IsRequired();
        builder.Property(e => e.TargetProtein).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.TargetFat).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.TargetCarbs).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.EffectiveFrom).IsRequired();
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(e => e.User)
            .WithMany(u => u.NutritionTargets)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.UserId, e.EffectiveFrom }).HasDatabaseName("idx_nutrition_targets_user");
    }
}

public class MealLogConfiguration : IEntityTypeConfiguration<MealLog>
{
    public void Configure(EntityTypeBuilder<MealLog> builder)
    {
        builder.ToTable("meal_logs");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.MealType).HasMaxLength(20).IsRequired();
        builder.Property(e => e.Calories).HasPrecision(7, 2).IsRequired();
        builder.Property(e => e.Protein).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.Fat).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.Carbs).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.LoggedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(e => e.IdempotencyKey)
            .IsUnique()
            .HasFilter("idempotency_key IS NOT NULL")
            .HasDatabaseName("uq_meal_logs_idempotency");

        builder.HasOne(e => e.User)
            .WithMany(u => u.MealLogs)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.UserId, e.LoggedAt }).HasDatabaseName("idx_meal_logs_user_date");
    }
}

public class MealLogItemConfiguration : IEntityTypeConfiguration<MealLogItem>
{
    public void Configure(EntityTypeBuilder<MealLogItem> builder)
    {
        builder.ToTable("meal_log_items");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Quantity).HasPrecision(10, 2).IsRequired();
        builder.Property(e => e.Unit).HasMaxLength(10).IsRequired();
        builder.Property(e => e.Calories).HasPrecision(7, 2).IsRequired();
        builder.Property(e => e.Protein).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.Fat).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.Carbs).HasPrecision(6, 2).IsRequired();

        builder.HasOne(e => e.MealLog)
            .WithMany(m => m.Items)
            .HasForeignKey(e => e.MealLogId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Product)
            .WithMany(p => p.MealLogItems)
            .HasForeignKey(e => e.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => e.MealLogId).HasDatabaseName("idx_meal_log_items_parent");
    }
}

public class RecipeConfiguration : IEntityTypeConfiguration<Recipe>
{
    public void Configure(EntityTypeBuilder<Recipe> builder)
    {
        builder.ToTable("recipes");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Title).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Description).IsRequired();
        builder.Property(e => e.Instructions).IsRequired();
        builder.Property(e => e.TotalCalories).HasPrecision(7, 2).IsRequired();
        builder.Property(e => e.TotalProtein).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.TotalFat).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.TotalCarbs).HasPrecision(6, 2).IsRequired();
        builder.Property(e => e.PrepTimeMinutes).HasDefaultValue(15);
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(e => e.Household)
            .WithMany(h => h.Recipes)
            .HasForeignKey(e => e.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.HouseholdId).HasDatabaseName("idx_recipes_household");
    }
}

public class RecipeIngredientConfiguration : IEntityTypeConfiguration<RecipeIngredient>
{
    public void Configure(EntityTypeBuilder<RecipeIngredient> builder)
    {
        builder.ToTable("recipe_ingredients");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Quantity).HasPrecision(10, 2).IsRequired();
        builder.Property(e => e.Unit).HasMaxLength(10).IsRequired();

        builder.HasOne(e => e.Recipe)
            .WithMany(r => r.Ingredients)
            .HasForeignKey(e => e.RecipeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Product)
            .WithMany(p => p.RecipeIngredients)
            .HasForeignKey(e => e.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => e.RecipeId).HasDatabaseName("idx_recipe_ingredients_recipe");
        builder.HasIndex(e => e.ProductId).HasDatabaseName("idx_recipe_ingredients_product");
    }
}

public class ShoppingListItemConfiguration : IEntityTypeConfiguration<ShoppingListItem>
{
    public void Configure(EntityTypeBuilder<ShoppingListItem> builder)
    {
        builder.ToTable("shopping_list_items");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.ProductName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Quantity).HasPrecision(10, 2).IsRequired();
        builder.Property(e => e.Unit).HasMaxLength(10).IsRequired();
        builder.Property(e => e.Version).HasDefaultValue(1);
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(e => e.Household)
            .WithMany(h => h.ShoppingListItems)
            .HasForeignKey(e => e.HouseholdId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.AddedByUser)
            .WithMany(u => u.ShoppingListItems)
            .HasForeignKey(e => e.AddedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Product)
            .WithMany(p => p.ShoppingListItems)
            .HasForeignKey(e => e.ProductId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(e => new { e.HouseholdId, e.IsPurchased })
            .HasDatabaseName("idx_shopping_list_household");
    }
}

public class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.EventType).HasMaxLength(100).IsRequired();
        builder.Property(e => e.Payload).HasColumnType("jsonb").IsRequired();
        builder.Property(e => e.Status).HasMaxLength(20).IsRequired().HasDefaultValue("PENDING");
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(e => e.CreatedAt)
            .HasFilter("status = 'PENDING'")
            .HasDatabaseName("idx_outbox_pending");
    }
}

public class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("idempotency_records");
        builder.HasKey(e => e.IdempotencyKey);

        builder.Property(e => e.IdempotencyKey).HasMaxLength(64);
        builder.Property(e => e.RequestPath).HasMaxLength(255).IsRequired();
        builder.Property(e => e.ResponseBody).HasColumnType("jsonb").IsRequired();
        builder.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(e => e.ExpiresAt).IsRequired();

        builder.HasOne(e => e.User)
            .WithMany(u => u.IdempotencyRecords)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.ExpiresAt).HasDatabaseName("idx_idempotency_expiry");
    }
}
