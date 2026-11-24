using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly AppDbContext _db;

    public PostsController(AppDbContext db) => _db = db;

    private int? CurrentUserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private string? CurrentUserRole => User.FindFirstValue(ClaimTypes.Role);

    [HttpGet("community/{communityId:int}")]
    public async Task<IActionResult> GetCommunityPosts(int communityId)
    {
        var userId = CurrentUserId;
        var isModerator = CurrentUserRole == nameof(UserRole.Moderator);

        var community = await _db.Communities.FindAsync(communityId);
        if (community == null || (community.IsBlocked && !isModerator))
            return NotFound(new { message = "Спільноту не знайдено." });

        var isOrganizer = userId.HasValue && community.OrganizerId == userId.Value;
        var isApprovedMember = userId.HasValue && await _db.Memberships.AnyAsync(m =>
            m.CommunityId == communityId && m.UserId == userId.Value && m.Status == MembershipStatus.Approved);

        var hasPrivateAccess = isOrganizer || isApprovedMember || isModerator;

        // Якщо спільнота закрита і користувач не учасник — жорстка відмова 403
        if (community.IsPrivate && !hasPrivateAccess)
            return StatusCode(403, new { message = "Доступ заборонено. Це закрита спільнота лише для чинних учасників." });

        var query = _db.Posts
            .Include(p => p.Author)
            .Where(p => p.CommunityId == communityId);

        if (!hasPrivateAccess)
            query = query.Where(p => !p.IsMembersOnly);

        if (!isModerator)
            query = query.Where(p => !p.IsHiddenByModerator);

        var posts = await query.OrderByDescending(p => p.CreatedAt).Select(p => new
        {
            p.Id,
            p.Title,
            p.Content,
            p.IsMembersOnly,
            p.IsHiddenByModerator,
            p.ModerationReason,
            AuthorName = p.Author!.FullName,
            p.CreatedAt
        }).ToListAsync();

        return Ok(posts);
    }

    // Прямий доступ до окремої публікації (для тестування захисту за прямою адресою)
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetPostById(int id)
    {
        var userId = CurrentUserId;
        var isModerator = CurrentUserRole == nameof(UserRole.Moderator);

        var post = await _db.Posts
            .Include(p => p.Community)
            .Include(p => p.Author)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post == null || (post.IsHiddenByModerator && !isModerator))
            return NotFound(new { message = "Публікацію не знайдено." });

        if (post.Community!.IsPrivate || post.IsMembersOnly)
        {
            var isOrganizer = userId.HasValue && post.Community.OrganizerId == userId.Value;
            var isMember = userId.HasValue && await _db.Memberships.AnyAsync(m =>
                m.CommunityId == post.CommunityId && m.UserId == userId.Value && m.Status == MembershipStatus.Approved);

            if (!isOrganizer && !isMember && !isModerator)
                return StatusCode(403, new { message = "Доступ до закритої публікації заборонено." });
        }

        return Ok(new
        {
            post.Id,
            post.CommunityId,
            post.Title,
            post.Content,
            post.IsMembersOnly,
            AuthorName = post.Author?.FullName,
            post.CreatedAt
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(CreatePostRequest req)
    {
        var userId = CurrentUserId!.Value;
        var community = await _db.Communities.FindAsync(req.CommunityId);
        if (community == null) return NotFound();

        var isOrganizer = community.OrganizerId == userId;
        var isMember = await _db.Memberships.AnyAsync(m =>
            m.CommunityId == req.CommunityId && m.UserId == userId && m.Status == MembershipStatus.Approved);

        if (!isOrganizer && !isMember)
            return StatusCode(403, new { message = "Публікувати дописи можуть лише учасники спільноти." });

        var post = new CommunityPost
        {
            CommunityId = req.CommunityId,
            AuthorId = userId,
            Title = req.Title.Trim(),
            Content = req.Content.Trim(),
            IsMembersOnly = community.IsPrivate || req.IsMembersOnly
        };

        _db.Posts.Add(post);
        await _db.SaveChangesAsync();

        return Ok(new { post.Id, post.Title });
    }

    [Authorize(Roles = "Moderator")]
    [HttpPost("{id:int}/moderate")]
    public async Task<IActionResult> Moderate(int id, ModeratePostRequest req)
    {
        var post = await _db.Posts.FindAsync(id);
        if (post == null) return NotFound();

        if (req.Hide && string.IsNullOrWhiteSpace(req.Reason))
            return BadRequest(new { message = "Для приховання публікації необхідно вказати причину." });

        post.IsHiddenByModerator = req.Hide;
        post.ModerationReason = req.Hide ? req.Reason!.Trim() : null;
        await _db.SaveChangesAsync();

        return Ok(new { post.IsHiddenByModerator, post.ModerationReason });
    }
}
