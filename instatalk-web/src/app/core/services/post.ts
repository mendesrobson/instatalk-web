import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Adicionada a propriedade commentsCount
export interface Post {
  id: string;
  ownerId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  hasLiked: boolean;
  commentsCount: number;
}

// NOVO: Interface para os comentários
export interface PostComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5027/api/v1';

  getFeed(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/posts`);
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/uploads/image`, formData);
  }

  createPost(content: string, imageUrl?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/posts`, { content, imageUrl });
  }

  toggleLike(postId: string): Observable<{ action: string }> {
    return this.http.post<{ action: string }>(`${this.apiUrl}/posts/${postId}/like`, {});
  }

  // --- NOVOS MÉTODOS DE COMENTÁRIOS ---
  getComments(postId: string): Observable<PostComment[]> {
    return this.http.get<PostComment[]>(`${this.apiUrl}/posts/${postId}/comments`);
  }

  addComment(postId: string, content: string): Observable<PostComment> {
    return this.http.post<PostComment>(`${this.apiUrl}/posts/${postId}/comments`, { content });
  }
}
