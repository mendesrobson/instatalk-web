import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interface tipada para garantir que o Frontend saiba o que esperar da API
export interface Post {
  id: string;
  ownerId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  hasLiked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5027/api/v1'; // Ajuste a porta se necessário

  // 1. Busca o Feed
  getFeed(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/posts`);
  }

  // 2. Upload de Imagem (Staging)
  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/uploads/image`, formData);
  }

  // 3. Criação do Post (Commit)
  createPost(content: string, imageUrl?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/posts`, { content, imageUrl });
  }

  // 4. Toggle Like
  toggleLike(postId: string): Observable<{ action: string }> {
    return this.http.post<{ action: string }>(`${this.apiUrl}/posts/${postId}/like`, {});
  }
}
