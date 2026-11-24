using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CommunitiesController : ControllerBase
{
    private readonly AppDbContext _db;

    public CommunitiesController(AppDbContext db) => _db = db;

    private int? CurrentUserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private string? CurrentUserRole => User.FindFirstValue(ClaimTypes.Role);

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? category, [FromQuery] bool? isPrivate)
    {
        var userId = CurrentUserId;
        var isModerator = CurrentUserRole == nameof(UserRole.Moderator);

        var query = _db.Communities
            .Include(c => c.Organizer)
            .Include(c => c.Memberships)
            .AsQueryable();

        if (!isModerator)
            query = query.Where(c => !c.IsBlocked);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(term) || c.Description.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(c => c.Category == category);

        if (isPrivate.HasValue)
            query = query.Where(c => c.IsPrivate == isPrivate.Value);

        var list = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();

        var result = list.Select(c =>
        {
            var myMembership = userId.HasValue ? c.Memberships.FirstOrDefault(m => m.UserId == userId.Value) : null;
            return new
            {
                c.Id,
                c.Name,
                c.Category,
                c.Description,
                c.IsPrivate,
                c.IsBlocked,
                c.OrganizerId,
                OrganizerName = c.Organizer?.FullName,
                MembersCount = c.Memberships.Count(m => m.Status == MembershipStatus.Approved),
                MyMembershipStatus = myMembership?.Status.ToString(),
                IsOrganizer = userId.HasValue && c.OrganizerId == userId.Value
            };
        });

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = CurrentUserId;
        var isModerator = CurrentUserRole == nameof(UserRole.Moderator);

        var community = await _db.Communities
            .Include(c => c.Organizer)
            .Include(c => c.Memberships).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (community == null || (community.IsBlocked && !isModerator))
            return NotFound(new { message = "Спільноту не знайдено." });

        var myMembership = userId.HasValue ? community.Memberships.FirstOrDefault(m => m.UserId == userId.Value) : null;
        var isOrganizer = userId.HasValue && community.OrganizerId == userId.Value;
        var isApprovedMember = myMembership?.Status == MembershipStatus.Approved || isOrganizer || isModerator;

        return Ok(new
        {
            community.Id,
            community.Name,
            community.Category,
            community.Description,
            community.IsPrivate,
            community.IsBlocked,
            community.OrganizerId,
            OrganizerName = community.Organizer?.FullName,
            MembersCount = community.Memberships.Count(m => m.Status == MembershipStatus.Approved),
            MyMembershipStatus = myMembership?.Status.ToString(),
            IsOrganizer = isOrganizer,
            CanViewPrivateContent = !community.IsPrivate || isApprovedMember,
            PendingRequests = isOrganizer
                ? community.Memberships.Where(m => m.Status == MembershipStatus.Pending).Select(m => new
                {
                    m.Id,
                    m.UserId,
                    UserName = m.User?.FullName,
                    UserEmail = m.User?.Email,
                    m.ApplicationNote,
                    m.RequestedAt
                })
                : null,
            ApprovedMembers = isOrganizer
                ? community.Memberships.Where(m => m.Status == MembershipStatus.Approved).Select(m => new
                {
                    m.Id,
                    m.UserId,
                    UserName = m.User?.FullName,
                    UserEmail = m.User?.Email,
                    m.UpdatedAt
                })
                : null
        });
    }

    [Authorize(Roles = "Organizer,Moderator")]
    [HttpPost]
    public async Task<IActionResult> Create(CreateCommunityRequest req)
    {
        var userId = CurrentUserId!.Value;
        var community = new Community
        {
            Name = req.Name.Trim(),
            Category = req.Category.Trim(),
            Description = req.Description.Trim(),
            IsPrivate = req.IsPrivate,
            OrganizerId = userId
        };

        _db.Communities.Add(community);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = community.Id }, new { community.Id, community.Name });
    }

    [Authorize]
    [HttpPost("{id:int}/join")]
    public async Task<IActionResult> Join(int id, [FromBody] JoinCommunityRequest? req)
    {
        var userId = CurrentUserId!.Value;
        var community = await _db.Communities.FindAsync(id);
        if (community == null || community.IsBlocked)
            return NotFound(new { message = "Спільноту не знайдено." });

        if (community.OrganizerId == userId)
            return BadRequest(new { message = "Ви є організатором цієї спільноти." });

        var existing = await _db.Memberships.FirstOrDefaultAsync(m => m.CommunityId == id && m.UserId == userId);

        if (existing != null)
        {
            if (existing.Status == MembershipStatus.Approved)
                return Conflict(new { message = "Ви вже є учасником цієї спільноти." });
            if (existing.Status == MembershipStatus.Pending)
                return Conflict(new { message = "Ваша заявка вже очікує розгляду." });

            // Повторний вступ після виходу або відхилення
            existing.Status = community.IsPrivate ? MembershipStatus.Pending : MembershipStatus.Approved;
            existing.ApplicationNote = req?.ApplicationNote;
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { status = existing.Status.ToString(), message = community.IsPrivate ? "Повторну заявку надіслано." : "Ви знову приєдналися до спільноти." });
        }

        var membership = new Membership
        {
            CommunityId = id,
            UserId = userId,
            Status = community.IsPrivate ? MembershipStatus.Pending : MembershipStatus.Approved,
            ApplicationNote = req?.ApplicationNote
        };

        _db.Memberships.Add(membership);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            status = membership.Status.ToString(),
            message = community.IsPrivate ? "Заявку на вступ надіслано організатору." : "Ви успішно приєдналися до спільноти!"
        });
    }

    [Authorize]
    [HttpPost("{id:int}/leave")]
    public async Task<IActionResult> Leave(int id)
    {
        var userId = CurrentUserId!.Value;
        var membership = await _db.Memberships.FirstOrDefaultAsync(m => m.CommunityId == id && m.UserId == userId);
        if (membership == null || membership.Status != MembershipStatus.Approved)
            return BadRequest(new { message = "Ви не є активним учасником цієї спільноти." });

        await RevokeMembershipAndCascadeEvents(membership);
        return Ok(new { message = "Ви вийшли зі спільноти. Майбутні реєстрації на події клубу скасовано." });
    }

    [Authorize(Roles = "Organizer,Moderator")]
    [HttpPost("{id:int}/memberships/{membershipId:int}/review")]
    public async Task<IActionResult> ReviewMembership(int id, int membershipId, ReviewMembershipRequest req)
    {
        var userId = CurrentUserId!.Value;
        var community = await _db.Communities.FindAsync(id);
        if (community == null) return NotFound();

        if (community.OrganizerId != userId && CurrentUserRole != nameof(UserRole.Moderator))
            return Forbid();

        var membership = await _db.Memberships.FirstOrDefaultAsync(m => m.Id == membershipId && m.CommunityId == id);
        if (membership == null) return NotFound();

        membership.Status = req.Approve ? MembershipStatus.Approved : MembershipStatus.Rejected;
        membership.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { status = membership.Status.ToString() });
    }

    [Authorize(Roles = "Organizer,Moderator")]
    [HttpPost("{id:int}/memberships/{membershipId:int}/revoke")]
    public async Task<IActionResult> RevokeMembership(int id, int membershipId)
    {
        var userId = CurrentUserId!.Value;
        var community = await _db.Communities.FindAsync(id);
        if (community == null) return NotFound();

        if (community.OrganizerId != userId && CurrentUserRole != nameof(UserRole.Moderator))
            return Forbid();

        var membership = await _db.Memberships.FirstOrDefaultAsync(m => m.Id == membershipId && m.CommunityId == id);
        if (membership == null) return NotFound();

        await RevokeMembershipAndCascadeEvents(membership);
        return Ok(new { message = "Членство відкликано, доступ до закритих матеріалів закрито." });
    }

    [Authorize(Roles = "Moderator")]
    [HttpPost("{id:int}/block")]
    public async Task<IActionResult> ToggleBlock(int id, [FromBody] bool block)
    {
        var community = await _db.Communities.FindAsync(id);
        if (community == null) return NotFound();
        community.IsBlocked = block;
        await _db.SaveChangesAsync();
        return Ok(new { community.IsBlocked });
    }

    // Бізнес-правило Варіанту 14: при виході/відкликанні членства скасовуємо майбутні реєстрації та просуваємо чергу
    private async Task RevokeMembershipAndCascadeEvents(Membership membership)
    {
        using var tx = await _db.Database.BeginTransactionAsync();

        membership.Status = MembershipStatus.Revoked;
        membership.UpdatedAt = DateTime.UtcNow;

        var futureRegs = await _db.EventRegistrations
            .Include(r => r.Event)
            .Where(r => r.UserId == membership.UserId
                        && r.Event!.CommunityId == membership.CommunityId
                        && r.Event.StartsAt > DateTime.UtcNow
                        && r.Status != RegistrationStatus.Cancelled)
            .ToListAsync();

        foreach (var reg in futureRegs)
        {
            var wasConfirmed = reg.Status == RegistrationStatus.Confirmed;
            reg.Status = RegistrationStatus.Cancelled;
            reg.UpdatedAt = DateTime.UtcNow;

            if (wasConfirmed)
            {
                var nextInWaitlist = await _db.EventRegistrations
                    .Where(r => r.EventId == reg.EventId && r.Status == RegistrationStatus.Waitlisted)
                    .OrderBy(r => r.RegisteredAt)
                    .FirstOrDefaultAsync();

                if (nextInWaitlist != null)
                {
                    nextInWaitlist.Status = RegistrationStatus.Confirmed;
                    nextInWaitlist.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await _db.SaveChangesAsync();
        await tx.CommitAsync();
    }
}
