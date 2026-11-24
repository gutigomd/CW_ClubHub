import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="max-width:460px; margin:1.5rem auto;">
      <div class="card">
        <div class="flex-gap" style="margin-bottom:1rem;">
          <button class="btn btn-sm" [class.btn-secondary]="isRegister" (click)="isRegister = false">Вхід</button>
          <button class="btn btn-sm" [class.btn-secondary]="!isRegister" (click)="isRegister = true">Реєстрація</button>
        </div>

        <h1 style="margin-top:0;">{{ isRegister ? 'Реєстрація в системі' : 'Вхід до платформи' }}</h1>

        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

        <form (ngSubmit)="submit()">
          @if (isRegister) {
            <div class="form-group">
              <label for="fullName">Прізвище та ім’я *</label>
              <input id="fullName" class="form-control" [(ngModel)]="fullName" name="fullName" required />
            </div>
          }
          <div class="form-group">
            <label for="email">Електронна пошта *</label>
            <input id="email" type="email" class="form-control" [(ngModel)]="email" name="email" required />
          </div>
          <div class="form-group">
            <label for="password">Пароль (мін. 8 символів) *</label>
            <input id="password" type="password" class="form-control" [(ngModel)]="password" name="password" required minlength="8" />
          </div>
          @if (isRegister) {
            <div class="form-group">
              <label for="role">Роль користувача</label>
              <select id="role" class="form-control" [(ngModel)]="role" name="role">
                <option [ngValue]="0">Учасник спільнот</option>
                <option [ngValue]="1">Організатор клубу</option>
              </select>
            </div>
          }
          <button class="btn" style="width:100%;" type="submit">{{ isRegister ? 'Зареєструватися' : 'Увійти' }}</button>
        </form>

        <div style="margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--border);">
          <p class="muted" style="margin:0 0 0.5rem;"><strong>Швидкий вхід для демонстрації (тестові ролі):</strong></p>
          <div class="flex-gap">
            <button type="button" class="btn btn-secondary btn-sm" (click)="demoLogin('user@club.ua', 'User12345!')">Учасник (Андрій)</button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="demoLogin('maria@club.ua', 'User12345!')">Учасниця (Марія)</button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="demoLogin('organizer@club.ua', 'Organizer123!')">Організатор (Олена)</button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="demoLogin('moderator@club.ua', 'Moderator123!')">Модератор (Ігор)</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  isRegister = false;
  fullName = '';
  email = '';
  password = '';
  role = 0;
  error = signal('');

  submit() {
    this.error.set('');
    const obs = this.isRegister
      ? this.auth.register(this.fullName, this.email, this.password, this.role)
      : this.auth.login(this.email, this.password);

    obs.subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: err => this.error.set(err.error?.message || 'Помилка автентифікації.')
    });
  }

  demoLogin(email: string, pass: string) {
    this.email = email;
    this.password = pass;
    this.isRegister = false;
    this.submit();
  }
}
