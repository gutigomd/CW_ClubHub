using Server.Models;
using Server.Services;

namespace Server.Data;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Users.Any()) return;

        var org = new User { FullName = "Олена Коваленко", Email = "organizer@club.ua", PasswordHash = PasswordHasher.Hash("Organizer123!"), Role = UserRole.Organizer };
        var user1 = new User { FullName = "Андрій Мельник", Email = "user@club.ua", PasswordHash = PasswordHasher.Hash("User12345!"), Role = UserRole.Participant };
        var user2 = new User { FullName = "Марія Шевченко", Email = "maria@club.ua", PasswordHash = PasswordHasher.Hash("User12345!"), Role = UserRole.Participant };
        var mod = new User { FullName = "Ігор Бондаренко", Email = "moderator@club.ua", PasswordHash = PasswordHasher.Hash("Moderator123!"), Role = UserRole.Moderator };

        db.Users.AddRange(org, user1, user2, mod);
        db.SaveChanges();

        var openClub = new Community
        {
            Name = "Одеський IT-клуб розробників",
            Category = "Технології",
            Description = "Відкрита спільнота для обміну досвідом у веб-розробці та підготовці до хакатонів.",
            IsPrivate = false,
            OrganizerId = org.Id
        };

        var privateClub = new Community
        {
            Name = "Закритий кіноклуб «Кадр»",
            Category = "Мистецтво",
            Description = "Закритий клуб поціновувачів авторського кіно. Доступ лише після погодження заявки.",
            IsPrivate = true,
            OrganizerId = org.Id
        };

        var sportClub = new Community
        {
            Name = "Біговий клуб «Приморський»",
            Category = "Спорт",
            Description = "Ранкові пробіжки вздовж узбережжя та підготовка до забігів.",
            IsPrivate = false,
            OrganizerId = org.Id
        };

        db.Communities.AddRange(openClub, privateClub, sportClub);
        db.SaveChanges();

        db.Memberships.AddRange(
            new Membership { CommunityId = openClub.Id, UserId = user1.Id, Status = MembershipStatus.Approved, ApplicationNote = "Цікавлюсь Angular та .NET" },
            new Membership { CommunityId = privateClub.Id, UserId = user1.Id, Status = MembershipStatus.Pending, ApplicationNote = "Люблю авторське кіно" },
            new Membership { CommunityId = privateClub.Id, UserId = user2.Id, Status = MembershipStatus.Approved, ApplicationNote = "Постійна учасниця" }
        );

        var ev1 = new ClubEvent
        {
            CommunityId = openClub.Id,
            Title = "Воркшоп: Архітектура веб-застосунків",
            Description = "Практичний розбір REST API, транзакцій та захисту даних.",
            Location = "м. Одеса, пр-т Шевченка, 1",
            StartsAt = DateTime.UtcNow.AddDays(5),
            MaxCapacity = 1,
            IsPrivateForMembersOnly = false
        };

        var ev2 = new ClubEvent
        {
            CommunityId = privateClub.Id,
            Title = "Закритий кінопоказ та обговорення",
            Description = "Зустріч учасників клубу з обговоренням стрічки.",
            Location = "м. Одеса, вул. Дерибасівська, 14",
            StartsAt = DateTime.UtcNow.AddDays(8),
            MaxCapacity = 15,
            IsPrivateForMembersOnly = true
        };

        db.Events.AddRange(ev1, ev2);
        db.SaveChanges();

        db.EventRegistrations.Add(new EventRegistration { EventId = ev1.Id, UserId = user2.Id, Status = RegistrationStatus.Confirmed });

        db.Posts.AddRange(
            new CommunityPost { CommunityId = openClub.Id, AuthorId = org.Id, Title = "Анонс весняного сезону", Content = "Вітаємо! Цього місяця проводимо серію воркшопів по веброзробці.", IsMembersOnly = false },
            new CommunityPost { CommunityId = privateClub.Id, AuthorId = org.Id, Title = "Секретний пароль для входу на показ", Content = "Код доступу до внутрішнього чату та локації: KADR-2026.", IsMembersOnly = true }
        );
        db.SaveChanges();
    }
}
