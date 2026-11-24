using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Community> Communities => Set<Community>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<ClubEvent> Events => Set<ClubEvent>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();
    public DbSet<CommunityPost> Posts => Set<CommunityPost>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<Membership>().HasIndex(m => new { m.CommunityId, m.UserId }).IsUnique();
        modelBuilder.Entity<EventRegistration>().HasIndex(r => new { r.EventId, r.UserId }).IsUnique();
        modelBuilder.Entity<Community>()
            .HasOne(c => c.Organizer)
            .WithMany()
            .HasForeignKey(c => c.OrganizerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
