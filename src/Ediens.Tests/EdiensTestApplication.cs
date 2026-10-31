using Ediens.Api.Data;
using Ediens.Api.Features.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;

namespace Ediens.Tests;

public class EdiensTestApplication : WebApplicationFactory<Program>
{
    private readonly string _dbName = "EdiensTestDb_" + Guid.NewGuid().ToString("N");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // 1. Замінюємо PostgreSQL на EF Core In-Memory провайдер для ізольованого тестування
            var dbContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<EdiensDbContext>));
            if (dbContextDescriptor != null)
            {
                services.Remove(dbContextDescriptor);
            }

            services.AddDbContext<EdiensDbContext>(options =>
            {
                options.UseInMemoryDatabase(_dbName);
            });

            // 2. Замінюємо Redis на In-Memory Distributed Cache
            var cacheDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IDistributedCache));
            if (cacheDescriptor != null)
            {
                services.Remove(cacheDescriptor);
            }
            services.AddDistributedMemoryCache();

            // 3. Ініціалізуємо демо-дані
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<EdiensDbContext>();
            db.Database.EnsureCreated();
            DatabaseSeeder.SeedAsync(db).GetAwaiter().GetResult();
        });
    }

    public HttpClient CreateUserClient(Guid userId)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", userId.ToString());
        return client;
    }
}
