import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'club_platform_auth';
  private userSignal = signal<AuthResponse | null>(this.loadFromStorage());

  user = this.userSignal.asReadonly();
  isLoggedIn = computed(() => !!this.userSignal());
  role = computed(() => this.userSignal()?.role ?? null);

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap(res => this.saveAuth(res))
    );
  }

  register(fullName: string, email: string, password: string, role: number) {
    return this.http.post<AuthResponse>('/api/auth/register', { fullName, email, password, role }).pipe(
      tap(res => this.saveAuth(res))
    );
  }

  logout() {
    localStorage.removeItem(this.storageKey);
    this.userSignal.set(null);
  }

  getToken(): string | null {
    return this.userSignal()?.token ?? null;
  }

  private saveAuth(res: AuthResponse) {
    localStorage.setItem(this.storageKey, JSON.stringify(res));
    this.userSignal.set(res);
  }

  private loadFromStorage(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
