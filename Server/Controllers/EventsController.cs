using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EventsController(AppDbContext db) => _db = db;

    private int? CurrentUserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private string? CurrentUserRole => User.FindFirstValue(ClaimTypes.Role);

    [HttpGet]
    public async Task<IActionResult> GetCalendar([FromQuery] int? communityId, [FromQuery] DateTime? fromDate)
    {
        var userId = CurrentUserId;
        var isModerator = CurrentUserRole == nameof(UserRole.Moderator);

        var approvedCommunityIds = userId.HasValue
            ? await _db.Memberships
                .Where(m => m.UserId == userId.Value && m.Status == MembershipStatus.Approved)
                .Select(m => m.CommunityId)
                .ToListAsync()
            : new List<int>();

        var organizedCommunityIds = userId.HasValue
            ? await _db.Communities
                .Where(c => c.OrganizerId == userId.Value)
                .Select(c => c.Id)
                .ToListAsync()
            : new List<int>();

        var query = _db.Events
            .Include(e => e.Community)
            .Include(e => e.Registrations)
            .Where(e => !e.Community!.IsBlocked)
            .AsQueryable();

        if (communityId.HasValue)
            query = query.Where(e => e.CommunityId == communityId.Value);

        if (fromDate.HasValue)
            query = query.Where(e => e.StartsAt >= fromDate.Value);

        var events = await query.OrderBy(e => e.StartsAt).ToListAsync();

        var result = events
            .Where(e => !e.IsPrivateForMembersOnly
                        || isModerator
                        || approvedCommunityIds.Contains(e.CommunityId)
                        || organizedCommunityIds.Contains(e.CommunityId))
            .Select(e =>
            {
                var confirmedCount = e.Registrations.Count(r => r.Status == RegistrationStatus.Confirmed);
                var waitlistCount = e.Registrations.Count(r => r.Status == RegistrationStatus.Waitlisted);
                var myReg = userId.HasValue ? e.Registrations.FirstOrDefault(r => r.UserId == userId.Value) : null;

                return new
                {
                    e.Id,
                    e.CommunityId,
                    CommunityName = e.Community?.Name,
                    e.Title,
                    e.Description,
                    e.Location,
                    e.StartsAt,
                    e.MaxCapacity,
                    ConfirmedCount = confirmedCount,
                    WaitlistCount = waitlistCount,
                    AvailableSeats = Math.Max(0, e.MaxCapacity - confirmedCount),
                    e.IsPrivateForMembersOnly,
                    MyRegistrationStatus = myReg?.Status.ToString()
                };
            });

        return Ok(result);
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> GetMyRegistrations()
    {
        var userId = CurrentUserId!.Value;
        var regs = await _db.EventRegistrations
            .Include(r => r.Event).ThenInclude(e => e!.Community)
            .Where(r => r.UserId == userId && r.Status != RegistrationStatus.Cancelled)
            .OrderBy(r => r.Event!.StartsAt)
            .Select(r => new
            {
                r.Id,
                r.EventId,
                EventTitle = r.Event!.Title,
                CommunityName = r.Event.Community!.Name,
                r.Event.Location,
                r.Event.StartsAt,
                Status = r.Status.ToString(),
                r.RegisteredAt
            })
            .ToListAsync();

        return Ok(regs);
    }

    [Authorize(Roles = "Organizer,Moderator")]
    [HttpPost]
    public async Task<IActionResult> Create(CreateEventRequest req)
    {
        var userId = CurrentUserId!.Value;
        var community = await _db.Communities.FindAsync(req.CommunityId);
        if (community == null) return NotFound(new { message = "Спільноту не знайдено." });

        if (community.OrganizerId != userId && CurrentUserRole != nameof(UserRole.Moderator))
            return Forbid();

        if (req.StartsAt <= DateTime.UtcNow)
            return BadRequest(new { message = "Дата події повинна бути в майбутньому." });

        var ev = new ClubEvent
        {
            CommunityId = req.CommunityId,
            Title = req.Title.Trim(),
            Description = req.Description.Trim(),
            Location = req.Location.Trim(),
            StartsAt = req.StartsAt,
            MaxCapacity = req.MaxCapacity,
            IsPrivateForMembersOnly = req.IsPrivateForMembersOnly
        };

        _db.Events.Add(ev);
        await _db.SaveChangesAsync();

        return Ok(new { ev.Id, ev.Title });
    }

    // Атомарна реєстрація з підтримкою списку очікування (Waitlist)
    [Authorize]
    [HttpPost("{id:int}/register")]
    public async Task<IActionResult> RegisterForEvent(int id)
    {
        var userId = CurrentUserId!.Value;

        using var tx = await _db.Database.BeginTransactionAsync();

        var ev = await _db.Events
            .Include(e => e.Community)
            .Include(e => e.Registrations)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (ev == null || ev.Community!.IsBlocked)
            return NotFound(new { message = "Подію не знайдено." });

        if (ev.StartsAt <= DateTime.UtcNow)
            return BadRequest(new { message = "Реєстрацію закрито: подія вже розпочалася." });

        // Перевірка членства в спільноті
        var isOrganizer = ev.Community.OrganizerId == userId;
        var isMember = await _db.Memberships.AnyAsync(m =>
            m.CommunityId == ev.CommunityId && m.UserId == userId && m.Status == MembershipStatus.Approved);

        if (!isOrganizer && !isMember)
            return StatusCode(403, new { message = "Реєстрація доступна лише чинним учасникам цієї спільноти." });

        var existing = ev.Registrations.FirstOrDefault(r => r.UserId == userId);
        if (existing != null && existing.Status != RegistrationStatus.Cancelled)
            return Conflict(new { message = $"Ви вже зареєстровані (статус: {existing.Status})." });

        var confirmedCount = ev.Registrations.Count(r => r.Status == RegistrationStatus.Confirmed);
        var assignedStatus = confirmedCount < ev.MaxCapacity
            ? RegistrationStatus.Confirmed
            : RegistrationStatus.Waitlisted;

        if (existing != null)
        {
            existing.Status = assignedStatus;
            existing.RegisteredAt = DateTime.UtcNow;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.EventRegistrations.Add(new EventRegistration
            {
                EventId = id,
                UserId = userId,
                Status = assignedStatus
            });
        }

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        var msg = assignedStatus == RegistrationStatus.Confirmed
            ? "Ви успішно зареєстровані на подію!"
            : "Вільних місць немає. Вас додано до списку очікування (Waitlist).";

        return Ok(new { status = assignedStatus.ToString(), message = msg });
    }

    // Скасування участі з автоматичним переведенням першого зі списку очікування
    [Authorize]
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> CancelRegistration(int id)
    {
        var userId = CurrentUserId!.Value;

        using var tx = await _db.Database.BeginTransactionAsync();

        var reg = await _db.EventRegistrations
            .FirstOrDefaultAsync(r => r.EventId == id && r.UserId == userId && r.Status != RegistrationStatus.Cancelled);

        if (reg == null)
            return NotFound(new { message = "Активну реєстрацію не знайдено." });

        var wasConfirmed = reg.Status == RegistrationStatus.Confirmed;
        reg.Status = RegistrationStatus.Cancelled;
        reg.UpdatedAt = DateTime.UtcNow;

        bool promotedSomeone = false;
        if (wasConfirmed)
        {
            var nextInLine = await _db.EventRegistrations
                .Where(r => r.EventId == id && r.Status == RegistrationStatus.Waitlisted)
                .OrderBy(r => r.RegisteredAt)
                .FirstOrDefaultAsync();

            if (nextInLine != null)
            {
                nextInLine.Status = RegistrationStatus.Confirmed;
                nextInLine.UpdatedAt = DateTime.UtcNow;
                promotedSomeone = true;
            }
        }

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new
        {
            message = promotedSomeone
                ? "Реєстрацію скасовано. Звільнене місце автоматично передано першому учаснику зі списку очікування."
                : "Вашу реєстрацію скасовано."
        });
    }
}
