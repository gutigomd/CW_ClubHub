import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { Community, CommunityPost, ClubEvent } from '../models/api.models';

@Component({
  selector: 'app-community-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (loading()) {
      <p class="muted">Завантаження сторінки спільноти...</p>
    } @else if (!community()) {
      <div class="alert alert-error">Спільноту не знайдено або вона заблокована.</div>
    } @else {
      @let c = community()!;

      @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <div class="card">
        <div class="flex-between">
          <div class="flex-gap">
            <span class="badge" [class.badge-private]="c.isPrivate" [class.badge-public]="!c.isPrivate">
              {{ c.isPrivate ? 'Закрита спільнота' : 'Відкрита спільнота' }}
            </span>
            <span class="muted">{{ c.category }}</span>
          </div>

          @if (auth.role() === 'Moderator') {
            <button class="btn btn-danger btn-sm" (click)="toggleBlock(!c.isBlocked)">
              {{ c.isBlocked ? 'Розблокувати спільноту' : 'Заблокувати спільноту' }}
            </button>
          }
        </div>

        <h1 style="margin:0.5rem 0;">{{ c.name }}</h1>
        <p>{{ c.description }}</p>

        <div class="flex-between" style="border-top:1px solid var(--border); padding-top:0.8rem; margin-top:0.8rem;">
          <span class="muted">Організатор: <strong>{{ c.organizerName }}</strong> • Учасників: <strong>{{ c.membersCount }}</strong></span>

          <div class="flex-gap">
            @if (auth.isLoggedIn() && !c.isOrganizer) {
              @if (c.myMembershipStatus === 'Approved') {
                <span class="badge badge-success">Ви чинний учасник</span>
                <button class="btn btn-danger btn-sm" (click)="leave()">Вийти зі спільноти</button>
              } @else if (c.myMembershipStatus === 'Pending') {
                <span class="badge badge-warn">Заявка очікує погодження</span>
              } @else {
                <button class="btn btn-sm" (click)="join()">{{ c.isPrivate ? 'Подати заявку на вступ' : 'Вступити до клубу' }}</button>
              }
            }
          </div>
        </div>
      </div>

      <!-- Панель організатора: погодження заявок та керування учасниками -->
      @if (c.isOrganizer) {
        <div class="card">
          <h2 style="margin-top:0;">Керування членством (Панель організатора)</h2>
          <h3>Заявки на вступ ({{ c.pendingRequests?.length || 0 }})</h3>
          @if (!c.pendingRequests?.length) {
            <p class="muted">Нових заявок немає.</p>
          } @else {
            @for (req of c.pendingRequests; track req.id) {
              <div class="flex-between" style="padding:0.6rem; border:1px solid var(--border); border-radius:6px; margin-bottom:0.5rem;">
                <div>
                  <strong>{{ req.userName }}</strong> ({{ req.userEmail }})
                  @if (req.applicationNote) { <div class="muted">Примітка: «{{ req.applicationNote }}»</div> }
                </div>
                <div class="flex-gap">
                  <button class="btn btn-sm" (click)="review(req.id, true)">Схвалити</button>
                  <button class="btn btn-danger btn-sm" (click)="review(req.id, false)">Відхилити</button>
                </div>
              </div>
            }
          }

          <h3>Чинні учасники ({{ c.approvedMembers?.length || 0 }})</h3>
          @if (!c.approvedMembers?.length) {
            <p class="muted">Учасників поки що немає.</p>
          } @else {
            @for (m of c.approvedMembers; track m.id) {
              <div class="flex-between" style="padding:0.5rem; border-bottom:1px solid var(--border);">
                <span>{{ m.userName }} ({{ m.userEmail }})</span>
                <button class="btn btn-secondary btn-sm" (click)="revoke(m.id)">Відкликати членство</button>
              </div>
            }
          }
        </div>
      }

      <!-- Перевірка доступу до закритого контенту -->
      @if (!c.canViewPrivateContent) {
        <div class="alert alert-info">
          <strong>Закритий розділ:</strong> публікації та внутрішні події цієї спільноти доступні лише схваленим учасникам.
          Подайте заявку на вступ та дочекайтеся підтвердження організатора.
        </div>
      } @else {
        <!-- Події спільноти -->
        <div class="card">
          <div class="flex-between">
            <h2 style="margin:0;">Події спільноти</h2>
            @if (c.isOrganizer) {
              <button class="btn btn-sm" (click)="showEventForm = !showEventForm">
                {{ showEventForm ? 'Скасувати' : '+ Додати подію' }}
              </button>
            }
          </div>

          @if (showEventForm) {
            <form (ngSubmit)="createEvent()" style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);">
              <div class="form-group">
                <label>Назва події *</label>
                <input class="form-control" [(ngModel)]="evTitle" name="evTitle" required />
              </div>
              <div class="form-group">
                <label>Опис *</label>
                <textarea class="form-control" rows="2" [(ngModel)]="evDesc" name="evDesc" required></textarea>
              </div>
              <div class="flex-gap">
                <div class="form-group" style="flex:1; min-width:200px;">
                  <label>Локація *</label>
                  <input class="form-control" [(ngModel)]="evLocation" name="evLocation" required />
                </div>
                <div class="form-group">
                  <label>Дата та час *</label>
                  <input type="datetime-local" class="form-control" [(ngModel)]="evStartsAt" name="evStartsAt" required />
                </div>
                <div class="form-group" style="width:140px;">
                  <label>Ліміт місць *</label>
                  <input type="number" min="1" class="form-control" [(ngModel)]="evCapacity" name="evCapacity" required />
                </div>
              </div>
              <div class="form-group">
                <label style="display:flex; gap:0.5rem; align-items:center;">
                  <input type="checkbox" [(ngModel)]="evPrivate" name="evPrivate" />
                  Лише для учасників клубу
                </label>
              </div>
              <button class="btn btn-sm" type="submit">Опублікувати подію</button>
            </form>
          }

          <div style="margin-top:1rem;">
            @if (events().length === 0) {
              <p class="muted">Запланованих подій поки немає.</p>
            } @else {
              @for (ev of events(); track ev.id) {
                <div style="padding:0.8rem; border:1px solid var(--border); border-radius:8px; margin-bottom:0.6rem;">
                  <div class="flex-between">
                    <strong>{{ ev.title }}</strong>
                    <span class="badge badge-public">Місць: {{ ev.confirmedCount }} / {{ ev.maxCapacity }} (Черга: {{ ev.waitlistCount }})</span>
                  </div>
                  <div class="muted" style="margin:0.3rem 0;">{{ ev.startsAt | date:'dd.MM.yyyy HH:mm' }} • {{ ev.location }}</div>
                  <p style="margin:0.4rem 0;">{{ ev.description }}</p>
                  @if (auth.isLoggedIn()) {
                    @if (ev.myRegistrationStatus === 'Confirmed') {
                      <span class="badge badge-success">Ви зареєстровані</span>
                    } @else if (ev.myRegistrationStatus === 'Waitlisted') {
                      <span class="badge badge-warn">Ви у списку очікування</span>
                    } @else {
                      <button class="btn btn-sm" (click)="registerEvent(ev.id)">
                        {{ ev.availableSeats > 0 ? 'Зареєструватися' : 'Стати в чергу очікування' }}
                      </button>
                    }
                  }
                </div>
              }
            }
          </div>
        </div>

        <!-- Публікації спільноти -->
        <div class="card">
          <div class="flex-between">
            <h2 style="margin:0;">Публікації та обговорення</h2>
            @if (c.isOrganizer || c.myMembershipStatus === 'Approved') {
              <button class="btn btn-sm" (click)="showPostForm = !showPostForm">
                {{ showPostForm ? 'Скасувати' : '+ Новий допис' }}
              </button>
            }
          </div>

          @if (showPostForm) {
            <form (ngSubmit)="createPost()" style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);">
              <div class="form-group">
                <label>Заголовок *</label>
                <input class="form-control" [(ngModel)]="postTitle" name="postTitle" required />
              </div>
              <div class="form-group">
                <label>Текст допису *</label>
                <textarea class="form-control" rows="3" [(ngModel)]="postContent" name="postContent" required></textarea>
              </div>
              @if (!c.isPrivate) {
                <div class="form-group">
                  <label style="display:flex; gap:0.5rem; align-items:center;">
                    <input type="checkbox" [(ngModel)]="postMembersOnly" name="postMembersOnly" />
                    Закритий допис (лише для чинних учасників)
                  </label>
                </div>
              }
              <button class="btn btn-sm" type="submit">Опублікувати</button>
            </form>
          }

          <div style="margin-top:1rem;">
            @if (posts().length === 0) {
              <p class="muted">У цій спільноті ще немає публікацій.</p>
            } @else {
              @for (p of posts(); track p.id) {
                <div style="padding:0.9rem; border:1px solid var(--border); border-radius:8px; margin-bottom:0.7rem;">
                  <div class="flex-between">
                    <strong>{{ p.title }}</strong>
                    <div class="flex-gap">
                      @if (p.isMembersOnly) { <span class="badge badge-private">Для учасників</span> }
                      @if (p.isHiddenByModerator) { <span class="badge badge-danger">Приховано: {{ p.moderationReason }}</span> }
                      @if (auth.role() === 'Moderator' && !p.isHiddenByModerator) {
                        <button class="btn btn-danger btn-sm" (click)="hidePost(p.id)">Приховати</button>
                      }
                    </div>
                  </div>
                  <div class="muted" style="font-size:0.83rem; margin-bottom:0.4rem;">
                    Автор: {{ p.authorName }} • {{ p.createdAt | date:'dd.MM.yyyy HH:mm' }}
                  </div>
                  <p style="margin:0; white-space:pre-line;">{{ p.content }}</p>
                </div>
              }
            }
          </div>
        </div>
      }
    }
  `
})
export class CommunityDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  auth = inject(AuthService);

  community = signal<Community | null>(null);
  posts = signal<CommunityPost[]>([]);
  events = signal<ClubEvent[]>([]);
  loading = signal(true);
  message = signal('');
  error = signal('');

  showPostForm = false;
  postTitle = '';
  postContent = '';
  postMembersOnly = false;

  showEventForm = false;
  evTitle = '';
  evDesc = '';
  evLocation = '';
  evStartsAt = '';
  evCapacity = 10;
  evPrivate = false;

  private communityId = 0;

  ngOnInit() {
    this.communityId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadAll();
  }

  loadAll() {
    this.loading.set(true);
    this.api.getCommunity(this.communityId).subscribe({
      next: c => {
        this.community.set(c);
        this.loading.set(false);
        if (c.canViewPrivateContent) {
          this.api.getCommunityPosts(this.communityId).subscribe(p => this.posts.set(p));
          this.api.getEvents(this.communityId).subscribe(e => this.events.set(e));
        }
      },
      error: () => { this.community.set(null); this.loading.set(false); }
    });
  }

  join() {
    const c = this.community()!;
    const note = c.isPrivate ? (prompt('Коментар до заявки (необов’язково):') || '') : '';
    this.api.joinCommunity(c.id, note).subscribe({
      next: res => { this.message.set(res.message); this.loadAll(); },
      error: err => this.error.set(err.error?.message || 'Помилка.')
    });
  }

  leave() {
    if (!confirm('Вийти зі спільноти? Ваші активні реєстрації на майбутні події цього клубу будуть автоматично скасовані.')) return;
    this.api.leaveCommunity(this.communityId).subscribe({
      next: res => { this.message.set(res.message); this.loadAll(); },
      error: err => this.error.set(err.error?.message || 'Помилка виходу.')
    });
  }

  review(membershipId: number, approve: boolean) {
    this.api.reviewMembership(this.communityId, membershipId, approve).subscribe({
      next: () => { this.message.set(approve ? 'Заявку схвалено.' : 'Заявку відхилено.'); this.loadAll(); }
    });
  }

  revoke(membershipId: number) {
    if (!confirm('Відкликати членство учасника та скасувати його майбутні реєстрації на події клубу?')) return;
    this.api.revokeMembership(this.communityId, membershipId).subscribe({
      next: res => { this.message.set(res.message); this.loadAll(); }
    });
  }

  toggleBlock(block: boolean) {
    this.api.toggleBlockCommunity(this.communityId, block).subscribe({
      next: () => { this.message.set(block ? 'Спільноту заблоковано.' : 'Спільноту розблоковано.'); this.loadAll(); }
    });
  }

  createPost() {
    if (!this.postTitle.trim() || !this.postContent.trim()) return;
    this.api.createPost({
      communityId: this.communityId,
      title: this.postTitle,
      content: this.postContent,
      isMembersOnly: this.postMembersOnly
    }).subscribe({
      next: () => {
        this.showPostForm = false;
        this.postTitle = '';
        this.postContent = '';
        this.message.set('Публікацію додано.');
        this.loadAll();
      },
      error: err => this.error.set(err.error?.message || 'Помилка створення допису.')
    });
  }

  hidePost(postId: number) {
    const reason = prompt('Вкажіть причину приховання публікації (обов’язково):');
    if (!reason?.trim()) return;
    this.api.moderatePost(postId, true, reason).subscribe({
      next: () => { this.message.set('Публікацію приховано модератором.'); this.loadAll(); }
    });
  }

  createEvent() {
    if (!this.evTitle.trim() || !this.evStartsAt) return;
    this.api.createEvent({
      communityId: this.communityId,
      title: this.evTitle,
      description: this.evDesc,
      location: this.evLocation,
      startsAt: new Date(this.evStartsAt).toISOString(),
      maxCapacity: this.evCapacity,
      isPrivateForMembersOnly: this.evPrivate
    }).subscribe({
      next: () => {
        this.showEventForm = false;
        this.evTitle = '';
        this.evDesc = '';
        this.message.set('Подію створено!');
        this.loadAll();
      },
      error: err => this.error.set(err.error?.message || 'Помилка створення події.')
    });
  }

  registerEvent(eventId: number) {
    this.error.set('');
    this.api.registerForEvent(eventId).subscribe({
      next: res => { this.message.set(res.message); this.loadAll(); },
      error: err => this.error.set(err.error?.message || 'Помилка реєстрації.')
    });
  }
}
