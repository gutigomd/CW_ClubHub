import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Community, ClubEvent } from '../models/api.models';

@Component({
  selector: 'app-communities-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero-banner">
      <div>
        <h1>Знаходь своїх людей та створюй події</h1>
        <p>Єдина платформа для клубів за інтересами, закритих спільнот, локальних воркшопів і зустрічей у твоєму місті.</p>
        <div class="hero-stats">
          <span class="stat-pill">🏛️ Активних клубів: {{ communities().length }}</span>
          <span class="stat-pill">📅 Найближчих подій: {{ upcomingEvents().length }}</span>
          <span class="stat-pill">⚡ Автоматичний Waitlist</span>
        </div>
        @if (auth.role() === 'Organizer' || auth.role() === 'Moderator') {
          <div style="margin-top:1.35rem;">
            <button class="btn" style="background:#fff; color:#1e1b4b; font-size:1rem; padding:0.75rem 1.4rem;" (click)="showCreate = !showCreate">
              {{ showCreate ? '✕ Закрити форму' : '+ Створити новий клуб' }}
            </button>
          </div>
        }
      </div>

      <!-- Тематична SVG-ілюстрація ком'юніті та подій -->
      <div class="hero-visual" aria-hidden="true">
        <svg width="360" height="210" viewBox="0 0 360 210" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="14" width="215" height="125" rx="18" fill="white" fill-opacity="0.14" stroke="white" stroke-opacity="0.28"/>
          <circle cx="46" cy="50" r="18" fill="#38BDF8"/>
          <rect x="76" y="38" width="120" height="10" rx="5" fill="white" fill-opacity="0.85"/>
          <rect x="76" y="55" width="84" height="8" rx="4" fill="#BAE6FD" fill-opacity="0.7"/>
          <rect x="28" y="84" width="178" height="36" rx="10" fill="#1E1B4B" fill-opacity="0.45"/>
          <circle cx="50" cy="102" r="9" fill="#34D399"/>
          <rect x="68" y="97" width="115" height="10" rx="5" fill="white" fill-opacity="0.9"/>

          <rect x="135" y="76" width="215" height="120" rx="18" fill="white" fill-opacity="0.96"/>
          <rect x="153" y="94" width="44" height="44" rx="12" fill="#EEF2FF"/>
          <text x="164" y="123" font-size="22">📅</text>
          <rect x="208" y="100" width="122" height="11" rx="5.5" fill="#1E1B4B"/>
          <rect x="208" y="119" width="88" height="9" rx="4.5" fill="#64748B"/>
          <rect x="153" y="152" width="179" height="28" rx="9" fill="#4F46E5"/>
          <text x="195" y="170" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">Участь підтверджено ✓</text>
        </svg>
      </div>
    </section>

    <!-- Швидкий вибір категорій великими плитками -->
    <div class="cat-pills">
      <button type="button" class="cat-tile" [class.active]="category === ''" (click)="selectCategory('')">
        <span class="cat-tile-icon">🌟</span><span>Усі напрямки</span>
      </button>
      <button type="button" class="cat-tile" [class.active]="category === 'Технології'" (click)="selectCategory('Технології')">
        <span class="cat-tile-icon">💻</span><span>Технології та IT</span>
      </button>
      <button type="button" class="cat-tile" [class.active]="category === 'Мистецтво'" (click)="selectCategory('Мистецтво')">
        <span class="cat-tile-icon">🎬</span><span>Кіно та мистецтво</span>
      </button>
      <button type="button" class="cat-tile" [class.active]="category === 'Спорт'" (click)="selectCategory('Спорт')">
        <span class="cat-tile-icon">🏃</span><span>Спорт і активність</span>
      </button>
      <button type="button" class="cat-tile" [class.active]="category === 'Освіта та наука'" (click)="selectCategory('Освіта та наука')">
        <span class="cat-tile-icon">🔬</span><span>Освіта та наука</span>
      </button>
    </div>

    @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    @if (showCreate) {
      <div class="card">
        <h2 style="margin-top:0;">✨ Нова спільнота</h2>
        <form (ngSubmit)="createCommunity()">
          <div class="form-group">
            <label for="cName">Назва спільноти *</label>
            <input id="cName" class="form-control" [(ngModel)]="newName" name="name" required maxlength="120" />
          </div>
          <div class="form-group">
            <label for="cCat">Категорія *</label>
            <select id="cCat" class="form-control" [(ngModel)]="newCategory" name="category">
              <option value="Технології">💻 Технології</option>
              <option value="Мистецтво">🎬 Мистецтво</option>
              <option value="Спорт">🏃 Спорт</option>
              <option value="Освіта та наука">🔬 Освіта та наука</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cDesc">Опис *</label>
            <textarea id="cDesc" class="form-control" rows="3" [(ngModel)]="newDescription" name="description" required></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" [(ngModel)]="newIsPrivate" name="isPrivate" />
              🔒 Закрита спільнота (вступ лише після схвалення організатором)
            </label>
          </div>
          <button class="btn" type="submit" [disabled]="submitting">Створити спільноту</button>
        </form>
      </div>
    }

    <div class="card" style="padding:1.1rem 1.4rem;">
      <div class="flex-gap">
        <input class="form-control" style="flex:1; min-width:260px;" placeholder="🔍 Пошук клубу за назвою або ключовим словом..."
               [(ngModel)]="search" (keyup.enter)="load()" aria-label="Пошук спільнот" />
        <select class="form-control" style="max-width:230px;" [(ngModel)]="privacyFilter" (change)="load()" aria-label="Тип доступу">
          <option value="">Усі формати доступу</option>
          <option value="false">🌐 Відкриті клуби</option>
          <option value="true">🔒 Закриті клуби</option>
        </select>
        <button class="btn" (click)="load()">Знайти</button>
      </div>
    </div>

    @if (loading()) {
      <p class="muted">Завантаження спільнот...</p>
    } @else if (communities().length === 0) {
      <div class="card">За вашим запитом спільнот не знайдено.</div>
    } @else {
      <div class="grid" style="margin-bottom:2.25rem;">
        @for (c of communities(); track c.id) {
          <article class="card club-card">
            <div class="club-cover" [ngClass]="getCoverClass(c.category)">
              <span class="badge badge-glass">
                {{ c.isPrivate ? '🔒 Закритий клуб' : '🌐 Відкритий клуб' }}
              </span>
              <span class="badge badge-glass">{{ c.category }}</span>
            </div>

            <div class="club-body">
              <div>
                <div class="club-emoji">{{ getCategoryEmoji(c.category) }}</div>
                @if (c.isBlocked) {
                  <span class="badge badge-danger" style="margin-bottom:0.4rem;">Заблоковано модератором</span>
                }
                <h3 style="margin:0.1rem 0 0.5rem; font-size:1.22rem;">
                  <a [routerLink]="['/communities', c.id]" style="color:var(--text);">{{ c.name }}</a>
                </h3>
                <p class="muted" style="margin:0 0 1.1rem;">{{ c.description }}</p>
              </div>

              <div>
                <div class="flex-between muted" style="margin-bottom:0.95rem; padding-top:0.85rem; border-top:1px solid var(--border); font-size:0.9rem;">
                  <span class="flex-gap" style="gap:0.5rem;">
                    <span class="avatar-circle">{{ c.organizerName[0] }}</span>
                    <span>{{ c.organizerName }}</span>
                  </span>
                  <span>👥 <strong>{{ c.membersCount }}</strong> учасн.</span>
                </div>

                <div class="flex-between">
                  <a class="btn btn-secondary btn-sm" [routerLink]="['/communities', c.id]">Перейти в клуб →</a>

                  @if (auth.isLoggedIn() && !c.isOrganizer) {
                    @if (c.myMembershipStatus === 'Approved') {
                      <span class="badge badge-success">✓ Ви учасник</span>
                    } @else if (c.myMembershipStatus === 'Pending') {
                      <span class="badge badge-warn">⏳ Заявка на розгляді</span>
                    } @else {
                      <button class="btn btn-sm" (click)="join(c)">
                        {{ c.isPrivate ? 'Подати заявку' : 'Вступити' }}
                      </button>
                    }
                  }
                </div>
              </div>
            </div>
          </article>
        }
      </div>
    }

    <!-- Секція найближчих подій та блок «Як працює платформа» -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap:1.5rem; margin-top:1rem;">
      @if (upcomingEvents().length > 0) {
        <section class="card" style="margin-bottom:0;">
          <div class="flex-between" style="margin-bottom:1rem;">
            <h2 style="margin:0; font-size:1.35rem;">🔥 Найближчі події спільнот</h2>
            <a routerLink="/events" class="btn btn-secondary btn-sm">Увесь календар →</a>
          </div>
          @for (ev of upcomingEvents(); track ev.id) {
            <div style="padding:1rem; border:1px solid var(--border); border-radius:12px; margin-bottom:0.75rem; background:#f8fafc;">
              <div class="flex-between" style="margin-bottom:0.4rem;">
                <a [routerLink]="['/communities', ev.communityId]" class="badge badge-public">🏛️ {{ ev.communityName }}</a>
                <span class="badge" [class.badge-warn]="ev.availableSeats === 0" [class.badge-success]="ev.availableSeats > 0">
                  {{ ev.availableSeats > 0 ? 'Вільно: ' + ev.availableSeats + '/' + ev.maxCapacity : 'Черга: ' + ev.waitlistCount }}
                </span>
              </div>
              <h3 style="margin:0.3rem 0; font-size:1.1rem;">{{ ev.title }}</h3>
              <div class="muted" style="font-size:0.88rem; margin-bottom:0.65rem;">
                🗓️ {{ ev.startsAt | date:'dd.MM.yyyy о HH:mm' }} • 📍 {{ ev.location }}
              </div>
              <a [routerLink]="['/communities', ev.communityId]" class="btn btn-sm">Детальніше та запис →</a>
            </div>
          }
        </section>
      }

      <section class="card" style="margin-bottom:0; background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
        <h2 style="margin-top:0; font-size:1.35rem;">🧭 Як працює ClubHub UA</h2>
        <div style="display:flex; flex-direction:column; gap:1rem; margin-top:1rem;">
          <div class="flex-gap" style="align-items:flex-start;">
            <span class="brand-icon" style="flex-shrink:0;">1</span>
            <div>
              <strong>Обирайте відкриті або закриті клуби</strong>
              <div class="muted">У відкриті спільноти вхід миттєвий, а для закритих клубів заявка передається організатору на погодження.</div>
            </div>
          </div>
          <div class="flex-gap" style="align-items:flex-start;">
            <span class="brand-icon" style="flex-shrink:0;">2</span>
            <div>
              <strong>Бронюйте місця з чергою очікування</strong>
              <div class="muted">Якщо ліміт місць вичерпано, ви потрапляєте у Waitlist і автоматично отримуєте місце при скасуванні кимось участі.</div>
            </div>
          </div>
          <div class="flex-gap" style="align-items:flex-start;">
            <span class="brand-icon" style="flex-shrink:0;">3</span>
            <div>
              <strong>Керуйте своїм розкладом та клубом</strong>
              <div class="muted">Організатори публікують закриті матеріали та події, а модератори стежать за дотриманням правил.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class CommunitiesPageComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  communities = signal<Community[]>([]);
  upcomingEvents = signal<ClubEvent[]>([]);
  loading = signal(true);
  message = signal('');
  error = signal('');

  search = '';
  category = '';
  privacyFilter = '';

  showCreate = false;
  submitting = false;
  newName = '';
  newCategory = 'Технології';
  newDescription = '';
  newIsPrivate = false;

  ngOnInit() {
    this.load();
    this.api.getEvents().subscribe({
      next: evs => this.upcomingEvents.set(evs.slice(0, 3))
    });
  }

  selectCategory(cat: string) {
    this.category = cat;
    this.load();
  }

  getCoverClass(cat: string): string {
    if (cat === 'Мистецтво') return 'cover-art';
    if (cat === 'Спорт') return 'cover-sport';
    if (cat === 'Освіта та наука') return 'cover-science';
    return 'cover-tech';
  }

  getCategoryEmoji(cat: string): string {
    if (cat === 'Мистецтво') return '🎬';
    if (cat === 'Спорт') return '🏃';
    if (cat === 'Освіта та наука') return '🔬';
    return '💻';
  }

  load() {
    this.loading.set(true);
    this.api.getCommunities(this.search, this.category, this.privacyFilter).subscribe({
      next: data => { this.communities.set(data); this.loading.set(false); },
      error: () => { this.error.set('Помилка завантаження каталогу.'); this.loading.set(false); }
    });
  }

  createCommunity() {
    if (!this.newName.trim() || !this.newDescription.trim()) return;
    this.submitting = true;
    this.error.set('');
    this.api.createCommunity({
      name: this.newName,
      category: this.newCategory,
      description: this.newDescription,
      isPrivate: this.newIsPrivate
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showCreate = false;
        this.newName = '';
        this.newDescription = '';
        this.message.set('Спільноту успішно створено!');
        this.load();
      },
      error: err => {
        this.submitting = false;
        this.error.set(err.error?.message || 'Не вдалося створити спільноту.');
      }
    });
  }

  join(c: Community) {
    this.error.set('');
    this.message.set('');
    const note = c.isPrivate ? (prompt('Коментар до заявки (необов’язково):') || '') : '';
    this.api.joinCommunity(c.id, note).subscribe({
      next: res => { this.message.set(res.message); this.load(); },
      error: err => this.error.set(err.error?.message || 'Помилка подачі заявки.')
    });
  }
}