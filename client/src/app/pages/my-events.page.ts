import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { MyRegistration } from '../models/api.models';

@Component({
  selector: 'app-my-events-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Мої реєстрації та участь у подіях</h1>
    <p class="muted">Особистий розклад підтверджених подій та позицій у списку очікування</p>

    @if (message()) { <div class="alert alert-success">{{ message() }}</div> }

    @if (loading()) {
      <p class="muted">Завантаження...</p>
    } @else if (items().length === 0) {
      <div class="card">Ви ще не зареєстровані на жодну подію.</div>
    } @else {
      @for (item of items(); track item.id) {
        <div class="card flex-between">
          <div>
            <div class="flex-gap" style="margin-bottom:0.3rem;">
              <span class="badge" [class.badge-success]="item.status === 'Confirmed'" [class.badge-warn]="item.status === 'Waitlisted'">
                {{ item.status === 'Confirmed' ? 'Підтверджено' : 'Список очікування (Waitlist)' }}
              </span>
              <span class="muted">{{ item.communityName }}</span>
            </div>
            <h3 style="margin:0.2rem 0;">{{ item.eventTitle }}</h3>
            <div class="muted">📅 {{ item.startsAt | date:'dd.MM.yyyy HH:mm' }} • 📍 {{ item.location }}</div>
          </div>
          <button class="btn btn-danger btn-sm" (click)="cancel(item.eventId)">Скасувати участь</button>
        </div>
      }
    }
  `
})
export class MyEventsPageComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<MyRegistration[]>([]);
  loading = signal(true);
  message = signal('');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getMyRegistrations().subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  cancel(eventId: number) {
    this.api.cancelRegistration(eventId).subscribe({
      next: res => { this.message.set(res.message); this.load(); }
    });
  }
}
