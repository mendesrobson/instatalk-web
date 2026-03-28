import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html'
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage = '';

  // Tipagem estrita de formulário
  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    website: [''] // <-- HONEYPOT: O campo armadilha
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    // Se é login, apontamos para o endpoint correto. Se fôssemos fazer a tela de registro,
    // enviaríamos o 'website' junto para banir o bot no C#.
    const { email, password, website } = this.loginForm.getRawValue();

    this.authService.login({ email, password }).subscribe({
      next: () => {
        // O redirecionamento já é feito pelo AuthService
      },
      error: (err) => {
        // Regra de Segurança Zero: Resposta genérica
        this.errorMessage = 'Credenciais inválidas.';
        console.error('Login failed', err);
      }
    });
  }
}
