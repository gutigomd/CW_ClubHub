import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ClubEvent } from '../models/api.models';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div style="margin-bottom:1.25rem;">
      <h1 style="margin:0;">📅 Календар клубних подій</h1>
      <p class="muted" style="margin:0.25rem 0 0;">Актуальні воркшопи, зустрічі та мітапи спільнот із контролем місць та автоматичною чергою очікування</p>
    </div>

    @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    @if (loading()) {
      <p class="muted">Завантаження розкладу...</p>
    } @else if (events().length === 0) {
      <div class="card">Наразі доступних подій немає.</div>
    } @else {
      <div class="grid">
        @for (ev of events(); track ev.id) {
          <article class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div class="flex-between" style="margin-bottom:0.5rem;">
                <a [routerLink]="['/communities', ev.communityId]" class="badge badge-public">
                  🏛️ {{ ev.communityName }}
                </a>
                <span class="badge" [class.badge-warn]="ev.availableSeats === 0" [class.badge-success]="ev.availableSeats > 0">
                  {{ ev.availableSeats > 0 ? 'Вільно: ' + ev.availableSeats + ' з ' + ev.maxCapacity : 'Місць немає (Черга: ' + ev.waitlistCount + ')' }}
                </span>
              </div>

              <h3 style="margin:0.35rem 0; font-size:1.15rem;">{{ ev.title }}</h3>

              <div class="muted" style="font-size:0.88rem; margin-bottom:0.65rem; display:flex; flex-direction:column; gap:0.2rem;">
                <span>🗓️ <strong>{{ ev.startsAt | date:'dd.MM.yyyy о HH:mm' }}</strong></span>
                <span>📍 {{ ev.location }}</span>
              </div>

              <p class="muted" style="margin:0 0 0.85rem;">{{ ev.description }}</p>

              <div style="margin-bottom:0.5rem;">
                <div class="flex-between" style="font-size:0.8rem; color:var(--muted);">
                  <span>Заповненість залу</span>
                  <span><strong>{{ ev.confirmedCount }}</strong> / {{ ev.maxCapacity }} місць</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" [class.progress-full]="ev.availableSeats === 0"
                       [style.width.%]="(ev.confirmedCount / ev.maxCapacity) * 100"></div>
                </div>
              </div>
            </div>

            <div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--border);">
              @if (!auth.isLoggedIn()) {
                <a routerLink="/login" class="btn btn-secondary btn-sm" style="width:100%;">Увійдіть для реєстрації</a>
              } @else if (ev.myRegistrationStatus === 'Confirmed') {
                <div class="flex-between">
                  <span class="badge badge-success">✓ Участь підтверджено</span>
                  <button class="btn btn-danger btn-sm" (click)="cancel(ev.id)">Скасувати</button>
                </div>
              } @else if (ev.myRegistrationStatus === 'Waitlisted') {
                <div class="flex-between">
                  <span class="badge badge-warn">⏳ У черзі очікування</span>
                  <button class="btn btn-danger btn-sm" (click)="cancel(ev.id)">Вийти з черги</button>
                </div>
              } @else {
                <button class="btn btn-sm" style="width:100%;" (click)="register(ev.id)">
                  {{ ev.availableSeats > 0 ? '🎟️ Зареєструватися на подію' : '⏳ Стати в список очікування' }}
                </button>
              }
            </div>
          </article>
        }
      </div>
    }
  `
})
export class EventsPageComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  events = signal<ClubEvent[]>([]);
  loading = signal(true);
  message = signal('');
  error = signal('');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getEvents().subscribe({
      next: data => { this.events.set(data); this.loading.set(false); },
      error: () => { this.error.set('Не вдалося завантажити події.'); this.loading.set(false); }
    });
  }

  register(id: number) {
    this.error.set('');
    this.message.set('');
    this.api.registerForEvent(id).subscribe({
      next: res => { this.message.set(res.message); this.load(); },
      error: err => this.error.set(err.error?.message || 'Помилка реєстрації.')
    });
  }

  cancel(id: number) {
    this.error.set('');
    this.message.set('');
    this.api.cancelRegistration(id).subscribe({
      next: res => { this.message.set(res.message); this.load(); },
      error: err => this.error.set(err.error?.message || 'Помилка скасування.')
    });
  }
}