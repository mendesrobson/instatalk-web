import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    // Ajuste o caminho conforme o nome exato que o CLI gerou (pode ser login.component)
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    // Ajustado para apontar para o componente real do feed recém-criado
    loadComponent: () => import('./features/feed/feed').then(m => m.Feed)
  }
];
