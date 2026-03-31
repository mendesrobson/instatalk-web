import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID); // Injetamos o identificador de plataforma

  // 1. Defesa SSR: Se estiver rodando no servidor Node.js, não temos localStorage.
  // Deixamos a rota renderizar a "casca" e confiamos na validação do navegador.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // 2. Defesa Real (Navegador): Aqui o localStorage existe.
  // O AuthService já leu o token no construtor.
  if (authService.isAuthenticated()) {
    return true;
  }

  // 3. Kick: Sem token real no navegador, joga para o login.
  router.navigate(['/login']);
  return false;
};
