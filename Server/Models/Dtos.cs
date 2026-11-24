using System.ComponentModel.DataAnnotations;

namespace Server.Models;

public record RegisterRequest(
    [Required, MaxLength(100)] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(8), MaxLength(64)] string Password,
    UserRole Role
);

public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public record AuthResponse(string Token, int UserId, string FullName, string Email, string Role);

public record CreateCommunityRequest(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(60)] string Category,
    [Required, MaxLength(1000)] string Description,
    bool IsPrivate
);

public record JoinCommunityRequest([MaxLength(300)] string? ApplicationNote);
public record ReviewMembershipRequest(bool Approve);

public record CreateEventRequest(
    int CommunityId,
    [Required, MaxLength(150)] string Title,
    [Required, MaxLength(1500)] string Description,
    [Required, MaxLength(200)] string Location,
    DateTime StartsAt,
    [Range(1, 5000)] int MaxCapacity,
    bool IsPrivateForMembersOnly
);

public record CreatePostRequest(
    int CommunityId,
    [Required, MaxLength(160)] string Title,
    [Required, MaxLength(4000)] string Content,
    bool IsMembersOnly
);

public record ModeratePostRequest(bool Hide, [MaxLength(300)] string? Reason);
