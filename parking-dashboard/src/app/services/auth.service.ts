import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API_URL = 'http://localhost:4000';
const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private tokenSig = signal<string | null>(null);
  token = this.tokenSig.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) this.tokenSig.set(token);
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.tokenSig());
  }

  async login(password: string): Promise<boolean> {
    const payload = { password };
    const result = await firstValueFrom(this.http.post<{ token: string }>(`${API_URL}/auth/login`, payload));
    if (!result?.token) return false;
    this.tokenSig.set(result.token);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem(TOKEN_KEY, result.token);
    }
    return true;
  }

  logout() {
    this.tokenSig.set(null);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }
}

