using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ediens.Api.Features.Common;
using Ediens.Api.Features.Meals;
using Ediens.Api.Features.Products;
using Xunit;

namespace Ediens.Tests;

public class IdempotencyAndRateLimitingTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public IdempotencyAndRateLimitingTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task MealLog_WithIdempotencyKey_RepeatedRequestReturnsCachedResultWithoutDuplicate()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);
        var idempotencyKey = Guid.NewGuid().ToString();

        var mealRequest = new CreateMealLogRequest(
            MealType: "Breakfast",
            LoggedAt: DateTime.UtcNow,
            Items: new List<MealLogItemInput>
            {
                new(
                    ProductId: DatabaseSeeder.OatmealProductId,
                    ProductName: "Вівсяні пластівці 'Ніжні'",
                    Quantity: 80m,
                    Unit: "g"
                )
            }
        );

        // 1. Перший запит
        var request1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/meals/log")
        {
            Content = JsonContent.Create(mealRequest)
        };
        request1.Headers.Add("Idempotency-Key", idempotencyKey);

        var response1 = await client.SendAsync(request1);
        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);
        var result1 = await response1.Content.ReadFromJsonAsync<MealLogResponse>();
        Assert.NotNull(result1);

        // 2. Повторний запит із тим самим Idempotency-Key (наприклад, після мережевого збою)
        var request2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/meals/log")
        {
            Content = JsonContent.Create(mealRequest)
        };
        request2.Headers.Add("Idempotency-Key", idempotencyKey);

        var response2 = await client.SendAsync(request2);
        Assert.True(response2.StatusCode == HttpStatusCode.Created || response2.StatusCode == HttpStatusCode.OK);

        // Повинно повернутися збережене тіло або заголовок реплею
        var result2 = await response2.Content.ReadFromJsonAsync<MealLogResponse>();
        Assert.NotNull(result2);
        Assert.Equal(result1.Id, result2.Id);
    }

    [Fact]
    public async Task BarcodeLookup_ValidCode_ReturnsProductNutritionalDetails()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var response = await client.GetAsync("/api/v1/products/barcode/4820000112233");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var product = await response.Content.ReadFromJsonAsync<ProductBarcodeDetailsResponse>();
        Assert.NotNull(product);
        Assert.Equal("4820000112233", product.Barcode);
        Assert.Equal("Молоко 'Селянське' 2.5%", product.Name);
        Assert.Equal("LocalDatabase", product.DataSource);
    }

    [Fact]
    public async Task BarcodeLookup_InvalidCode_Returns400ValidationError()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);

        var response = await client.GetAsync("/api/v1/products/barcode/invalid_code");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(400, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("VALIDATION_FAILED", doc.RootElement.GetProperty("errorCode").GetString());
    }
}

public class SlidingWindowRateLimitingTests : IClassFixture<EdiensTestApplication>
{
    private readonly EdiensTestApplication _app;

    public SlidingWindowRateLimitingTests(EdiensTestApplication app)
    {
        _app = app;
    }

    [Fact]
    public async Task BarcodeLookup_RapidRequests_TriggersSlidingWindowRateLimiting()
    {
        var client = _app.CreateUserClient(DatabaseSeeder.OlegUserId);
        bool rateLimitHit = false;

        // Політика баркодів налаштована на 30 запитів/хв
        for (int i = 0; i < 40; i++)
        {
            var response = await client.GetAsync("/api/v1/products/barcode/4820000112233");
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                rateLimitHit = true;
                Assert.True(response.Headers.Contains("Retry-After"));

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                Assert.Equal(429, doc.RootElement.GetProperty("status").GetInt32());
                Assert.Equal("RATE_LIMIT_EXCEEDED", doc.RootElement.GetProperty("errorCode").GetString());
                break;
            }
        }

        Assert.True(rateLimitHit, "Rate limiter should reject requests exceeding sliding window permit limit.");
    }
}
