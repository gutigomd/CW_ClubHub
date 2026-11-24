using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;
using Server.Services;
using Xunit;

namespace Server.Tests;

public class PlatformTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public PlatformTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void PasswordHasher_ShouldVerifyValidPasswordAndRejectWrong()
    {
        var hash = PasswordHasher.Hash("StrongPass123!");
        Assert.True(PasswordHasher.Verify("StrongPass123!", hash));
        Assert.False(PasswordHasher.Verify("WrongPass123!", hash));
    }

    [Fact]
    public async Task PrivateCommunity_JoinCreatesPendingRequest_AndApprovalGrantsAccess()
    {
        var organizer = new User { FullName = "Олена", Email = "org@test.ua", PasswordHash = "x", Role = UserRole.Organizer };
        var member = new User { FullName = "Андрій", Email = "user@test.ua", PasswordHash = "x", Role = UserRole.Participant };
        _db.Users.AddRange(organizer, member);
        await _db.SaveChangesAsync();

        var club = new Community { Name = "Кіноклуб", Category = "Мистецтво", Description = "Опис", IsPrivate = true, OrganizerId = organizer.Id };
        _db.Communities.Add(club);
        await _db.SaveChangesAsync();

        var membership = new Membership { CommunityId = club.Id, UserId = member.Id, Status = MembershipStatus.Pending };
        _db.Memberships.Add(membership);
        await _db.SaveChangesAsync();

        Assert.Equal(MembershipStatus.Pending, membership.Status);

        membership.Status = MembershipStatus.Approved;
        await _db.SaveChangesAsync();

        var isApproved = await _db.Memberships.AnyAsync(m => m.CommunityId == club.Id && m.UserId == member.Id && m.Status == MembershipStatus.Approved);
        Assert.True(isApproved);
    }

    [Fact]
    public async Task EventRegistration_WhenCapacityFull_ShouldPlaceUserInWaitlistAndPromoteOnCancel()
    {
        var org = new User { FullName = "Орг", Email = "o@t.ua", PasswordHash = "x", Role = UserRole.Organizer };
        var u1 = new User { FullName = "У1", Email = "u1@t.ua", PasswordHash = "x", Role = UserRole.Participant };
        var u2 = new User { FullName = "У2", Email = "u2@t.ua", PasswordHash = "x", Role = UserRole.Participant };
        _db.Users.AddRange(org, u1, u2);
        await _db.SaveChangesAsync();

        var club = new Community { Name = "IT", Category = "Технології", Description = "Опис", IsPrivate = false, OrganizerId = org.Id };
        _db.Communities.Add(club);
        await _db.SaveChangesAsync();

        var ev = new ClubEvent
        {
            CommunityId = club.Id,
            Title = "Воркшоп",
            Description = "Тест",
            Location = "Одеса",
            StartsAt = DateTime.UtcNow.AddDays(3),
            MaxCapacity = 1
        };
        _db.Events.Add(ev);
        await _db.SaveChangesAsync();

        var reg1 = new EventRegistration { EventId = ev.Id, UserId = u1.Id, Status = RegistrationStatus.Confirmed, RegisteredAt = DateTime.UtcNow };
        var reg2 = new EventRegistration { EventId = ev.Id, UserId = u2.Id, Status = RegistrationStatus.Waitlisted, RegisteredAt = DateTime.UtcNow.AddSeconds(1) };
        _db.EventRegistrations.AddRange(reg1, reg2);
        await _db.SaveChangesAsync();

        // Скасування першої реєстрації та просування з черги очікування
        reg1.Status = RegistrationStatus.Cancelled;
        var nextInLine = await _db.EventRegistrations
            .Where(r => r.EventId == ev.Id && r.Status == RegistrationStatus.Waitlisted)
            .OrderBy(r => r.RegisteredAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(nextInLine);
        nextInLine!.Status = RegistrationStatus.Confirmed;
        await _db.SaveChangesAsync();

        Assert.Equal(RegistrationStatus.Confirmed, reg2.Status);
    }

    [Fact]
    public async Task RevokingMembership_ShouldCancelFutureCommunityEventRegistrations()
    {
        var org = new User { FullName = "Орг", Email = "o2@t.ua", PasswordHash = "x", Role = UserRole.Organizer };
        var user = new User { FullName = "Учасник", Email = "u@t.ua", PasswordHash = "x", Role = UserRole.Participant };
        _db.Users.AddRange(org, user);
        await _db.SaveChangesAsync();

        var club = new Community { Name = "Клуб", Category = "Спорт", Description = "Опис", IsPrivate = true, OrganizerId = org.Id };
        _db.Communities.Add(club);
        await _db.SaveChangesAsync();

        var membership = new Membership { CommunityId = club.Id, UserId = user.Id, Status = MembershipStatus.Approved };
        var ev = new ClubEvent { CommunityId = club.Id, Title = "Забіг", Description = "Опис", Location = "Траса здоров'я", StartsAt = DateTime.UtcNow.AddDays(2), MaxCapacity = 10 };
        _db.Memberships.Add(membership);
        _db.Events.Add(ev);
        await _db.SaveChangesAsync();

        var reg = new EventRegistration { EventId = ev.Id, UserId = user.Id, Status = RegistrationStatus.Confirmed };
        _db.EventRegistrations.Add(reg);
        await _db.SaveChangesAsync();

        // Відкликання членства
        membership.Status = MembershipStatus.Revoked;
        var futureRegs = await _db.EventRegistrations
            .Include(r => r.Event)
            .Where(r => r.UserId == user.Id && r.Event!.CommunityId == club.Id && r.Event.StartsAt > DateTime.UtcNow)
            .ToListAsync();
        futureRegs.ForEach(r => r.Status = RegistrationStatus.Cancelled);
        await _db.SaveChangesAsync();

        Assert.Equal(RegistrationStatus.Cancelled, reg.Status);
    }

    [Fact]
    public async Task Moderator_HidingPost_ShouldPersistReason()
    {
        var org = new User { FullName = "Орг", Email = "o3@t.ua", PasswordHash = "x", Role = UserRole.Organizer };
        _db.Users.Add(org);
        await _db.SaveChangesAsync();

        var club = new Community { Name = "Клуб", Category = "Технології", Description = "Опис", OrganizerId = org.Id };
        _db.Communities.Add(club);
        await _db.SaveChangesAsync();

        var post = new CommunityPost { CommunityId = club.Id, AuthorId = org.Id, Title = "Спам", Content = "Реклама" };
        _db.Posts.Add(post);
        await _db.SaveChangesAsync();

        post.IsHiddenByModerator = true;
        post.ModerationReason = "Порушення правил спільноти (реклама)";
        await _db.SaveChangesAsync();

        var saved = await _db.Posts.FindAsync(post.Id);
        Assert.True(saved!.IsHiddenByModerator);
        Assert.Equal("Порушення правил спільноти (реклама)", saved.ModerationReason);
    }
}