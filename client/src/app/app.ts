import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="navbar">
      <nav class="container flex-between" style="padding-top:0.75rem; padding-bottom:0.75rem;" aria-label="Головна навігація">
        <div class="flex-gap">
          <a routerLink="/" class="brand-logo" style="margin-right:0.75rem;">
            <span class="brand-icon">✦</span>
            <span>ClubHub <span style="color:var(--primary);">UA</span></span>
          </a>
          <a routerLink="/" class="nav-link" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact:true}">🏛️ Спільноти</a>
          <a routerLink="/events" class="nav-link" routerLinkActive="active-link">📅 Календар подій</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/my-events" class="nav-link" routerLinkActive="active-link">🎟️ Мої участі</a>
          }
        </div>

        <div class="flex-gap">
          @if (auth.user(); as u) {
            <div class="flex-gap" style="background:#f1f5f9; padding:0.35rem 0.8rem; border-radius:999px;">
              <span class="avatar-circle">{{ u.fullName[0] }}</span>
              <span style="font-size:0.9rem; font-weight:600;">{{ u.fullName }}</span>
              <span class="badge badge-public">{{ translateRole(u.role) }}</span>
            </div>
            <button class="btn btn-secondary btn-sm" (click)="logout()">Вийти</button>
          } @else {
            <a routerLink="/login" class="btn btn-sm">Увійти / Реєстрація</a>
          }
        </div>
      </nav>
    </header>

    <main class="container">
      <router-outlet></router-outlet>
    </main>

    <footer class="site-footer">
      <div class="container flex-between" style="padding-top:0; padding-bottom:0;">
        <div>
          <strong style="color:#fff; font-size:1.05rem;">✦ ClubHub UA</strong> — Платформа спільнот і клубних подій
        </div>
        <div class="flex-gap">
          <a routerLink="/" style="color:#93c5fd;">Каталог клубів</a>
          <span>•</span>
          <a routerLink="/events" style="color:#93c5fd;">Розклад подій</a>
          <span>•</span>
          <a routerLink="/login" style="color:#93c5fd;">Демо-вхід (Ролі)</a>
        </div>
      </div>
    </footer>
  `
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);

  translateRole(role: string): string {
    if (role === 'Organizer') return 'Організатор';
    if (role === 'Moderator') return 'Модератор';
    return 'Учасник';
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}