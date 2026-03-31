import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

// Variáveis de estado fora da função para manter o contexto entre múltiplas requisições
let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Função helper para clonar e injetar o token
  const addToken = (request: HttpRequest<any>, jwt: string | null) => {
    if (jwt) {
      return request.clone({ setHeaders: { Authorization: `Bearer ${jwt}` } });
    }
    return request;
  };

  return next(addToken(req, token)).pipe(
    catchError((error: HttpErrorResponse) => {
      // Verifica se o erro é 401 e NÃO é a própria rota de refresh ou login (para evitar loop infinito)
      if (error.status === 401 && !req.url.includes('/login') && !req.url.includes('/refresh')) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

// A Máquina de Estados do Refresh
const handle401Error = (request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService): Observable<HttpEvent<any>> => {
  if (!isRefreshing) {
    // 1. Tranca a porta: Ninguém mais faz refresh até eu terminar
    isRefreshing = true;
    refreshTokenSubject.next(null);

    // 2. Chama o C# para renovar
    return authService.refreshToken().pipe(
      switchMap((tokenResponse: any) => {
        isRefreshing = false;

        // 3. Avisa a fila de espera que o novo token chegou
        refreshTokenSubject.next(tokenResponse.accessToken);

        // 4. Reenvia a requisição original que falhou, agora com o token novo
        return next(request.clone({ setHeaders: { Authorization: `Bearer ${tokenResponse.accessToken}` } }));
      }),
      catchError((err) => {
        // Se o Refresh Token falhou ou expirou, a sessão do usuário acabou.
        isRefreshing = false;
        authService.logout(); // O próprio logout já limpa a sessão e redireciona
        return throwError(() => err);
      })
    );
  } else {
    // Se isRefreshing for true, significa que outra requisição já disparou o processo de refresh.
    // Colocamos esta requisição na fila de espera até que o token não seja mais nulo.
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => {
        return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
      })
    );
  }
};
