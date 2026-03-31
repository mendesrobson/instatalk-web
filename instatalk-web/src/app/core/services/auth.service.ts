import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5027/api/v1/auth';

  // Zoneless Architecture: Signals são a única fonte da verdade
  isAuthenticated = signal<boolean>(false);
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    // Defense in Depth: Só toca no Storage se estiver no Browser (evita crash no SSR)
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.isAuthenticated.set(this.hasToken());
    }
  }

  login(credentials: any) {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        if (this.isBrowser) {
          localStorage.setItem('access_token', response.accessToken);
          localStorage.setItem('refresh_token', response.refreshToken);
          localStorage.setItem('user_email', credentials.email);

          this.isAuthenticated.set(true);
        }
        this.router.navigate(['/feed']);
      })
    );
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next: () => this.clearLocalSession(),
      error: () => this.clearLocalSession()
    });
  }

private clearLocalSession() {
    if (this.isBrowser) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // Limpamos o e-mail quando a sessão morre ou o usuário desloga
      localStorage.removeItem('user_email');
      this.isAuthenticated.set(false);
    }
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('access_token');
    }
    return null; // No servidor, não temos token local
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  refreshToken() {
      let rToken = null;
      let userEmail = null;

      // Buscamos o token E o e-mail do storage
      if (this.isBrowser) {
        rToken = localStorage.getItem('refresh_token');
        userEmail = localStorage.getItem('user_email');
      }

      if (!rToken) {
        this.clearLocalSession();
        throw new Error('No refresh token available');
      }

      // Enviamos os dois juntos no payload (rToken e userEmail)
      return this.http.post<any>(`${this.apiUrl}/refresh`, {
        refreshToken: rToken,
        email: userEmail
      }).pipe(
        tap(response => {
          if (this.isBrowser) {
            localStorage.setItem('access_token', response.accessToken);
            localStorage.setItem('refresh_token', response.refreshToken);
          }
        })
      );
    }

  // Helper para salvar os tokens externamente (usado pelo Interceptor)
  updateTokens(accessToken: string, refreshToken: string) {
    if (this.isBrowser) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    }
  }
}
