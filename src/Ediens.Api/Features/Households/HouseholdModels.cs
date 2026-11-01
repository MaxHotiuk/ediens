using System.Text.Json.Serialization;

namespace Ediens.Api.Features.Households;

public record HouseholdSummaryResponse(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("inviteCode")] string InviteCode,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("membersCount")] int MembersCount,
    [property: JsonPropertyName("createdAt")] DateTime CreatedAt,
    [property: JsonPropertyName("updatedAt")] DateTime UpdatedAt
);

public record JoinHouseholdRequest(
    [property: JsonPropertyName("inviteCode")] string InviteCode
);

public record HouseholdMemberResponse(
    [property: JsonPropertyName("userId")] Guid UserId,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("joinedAt")] DateTime JoinedAt
);
