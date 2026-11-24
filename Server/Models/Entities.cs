using System.ComponentModel.DataAnnotations;

namespace Server.Models;

public enum UserRole { Participant = 0, Organizer = 1, Moderator = 2 }
public enum MembershipStatus { Pending = 0, Approved = 1, Rejected = 2, Revoked = 3 }
public enum RegistrationStatus { Confirmed = 0, Waitlisted = 1, Cancelled = 2 }

public class User
{
    public int Id { get; set; }
    [Required, MaxLength(100)] public string FullName { get; set; } = string.Empty;
    [Required, EmailAddress, MaxLength(150)] public string Email { get; set; } = string.Empty;
    [Required] public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Participant;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
}

public class Community
{
    public int Id { get; set; }
    [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;
    [Required, MaxLength(60)] public string Category { get; set; } = string.Empty;
    [Required, MaxLength(1000)] public string Description { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public bool IsBlocked { get; set; }
    public int OrganizerId { get; set; }
    public User? Organizer { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
    public ICollection<ClubEvent> Events { get; set; } = new List<ClubEvent>();
    public ICollection<CommunityPost> Posts { get; set; } = new List<CommunityPost>();
}

public class Membership
{
    public int Id { get; set; }
    public int CommunityId { get; set; }
    public Community? Community { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public MembershipStatus Status { get; set; } = MembershipStatus.Pending;
    [MaxLength(300)] public string? ApplicationNote { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class ClubEvent
{
    public int Id { get; set; }
    public int CommunityId { get; set; }
    public Community? Community { get; set; }
    [Required, MaxLength(150)] public string Title { get; set; } = string.Empty;
    [Required, MaxLength(1500)] public string Description { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string Location { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    [Range(1, 5000)] public int MaxCapacity { get; set; }
    public bool IsPrivateForMembersOnly { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<EventRegistration> Registrations { get; set; } = new List<EventRegistration>();
}

public class EventRegistration
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public ClubEvent? Event { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public RegistrationStatus Status { get; set; } = RegistrationStatus.Confirmed;
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class CommunityPost
{
    public int Id { get; set; }
    public int CommunityId { get; set; }
    public Community? Community { get; set; }
    public int AuthorId { get; set; }
    public User? Author { get; set; }
    [Required, MaxLength(160)] public string Title { get; set; } = string.Empty;
    [Required, MaxLength(4000)] public string Content { get; set; } = string.Empty;
    public bool IsMembersOnly { get; set; }
    public bool IsHiddenByModerator { get; set; }
    [MaxLength(300)] public string? ModerationReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
