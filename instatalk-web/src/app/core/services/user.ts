import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserSearchResult {
  id: string;
  email: string;
  isFollowing: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5027/api/v1/users';

  searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${this.apiUrl}/search?q=${query}`);
  }

  toggleFollow(userId: string): Observable<{ action: string }> {
    return this.http.post<{ action: string }>(`${this.apiUrl}/${userId}/follow`, {});
  }
}
