import { Component, inject, OnInit, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DatePipe } from '@angular/common';
// Adicione o FormControl aos imports do ReactiveFormsModule
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { PostService, Post } from '../../core/services/post';
import { UserService, UserSearchResult } from '../../core/services/user';
// Importes do RxJS para a busca inteligente
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './feed.html'
})
export class Feed implements OnInit {
  private postService = inject(PostService);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);
  private userService = inject(UserService);

  // A base URL do backend para renderizar as imagens estáticas
  readonly apiBaseUrl = 'http://localhost:5027';

  posts = signal<Post[]>([]);
  errorMessage = signal<string>('');
  // Variáveis da Barra de Busca
  searchControl = new FormControl('');
  searchResults = signal<UserSearchResult[]>([]);
  isSearching = signal<boolean>(false);

  // Dicionário para controlar se a aba de comentários está aberta: { 'id-do-post': true }
  expandedComments = signal<Record<string, boolean>>({});

  // Dicionário para guardar os comentários cacheados: { 'id-do-post': [comentarios...] }
  postComments = signal<Record<string, any[]>>({});

  // Controle do arquivo selecionado
  selectedFile: File | null = null;

  // Formulário estritamente tipado (Defense in Depth no frontend)
  postForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(500)]]
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFeed();
      this.setupSearch();
    }
  }

  private setupSearch() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300), // Espera o usuário parar de digitar por 300ms
      distinctUntilChanged(), // Só busca se o texto realmente mudou
      switchMap(query => {
        if (!query || query.trim().length < 2) {
          this.searchResults.set([]);
          return of([]); // Retorna um array vazio (cancela a busca)
        }
        this.isSearching.set(true);
        return this.userService.searchUsers(query);
      })
    ).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.isSearching.set(false);
      },
      error: () => {
        this.searchResults.set([]);
        this.isSearching.set(false);
      }
    });
  }

  // Método do Botão Seguir (Optimistic UI)
  toggleFollowUser(user: UserSearchResult) {
    const previousState = user.isFollowing;
    user.isFollowing = !user.isFollowing; // Muda a UI instantaneamente

    this.userService.toggleFollow(user.id).subscribe({
      next: () => {
        // Sucesso silencioso
      },
      error: () => {
        user.isFollowing = previousState; // Rollback em caso de falha
        alert('Erro ao processar a ação de seguir.');
      }
    });
  }

  loadFeed() {
    this.postService.getFeed().subscribe({
      next: (data) => this.posts.set(data),
      error: () => this.errorMessage.set('Não foi possível carregar o feed.')
    });
  }

  // Captura o arquivo quando o usuário escolhe a foto
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  submitPost() {
    if (this.postForm.invalid) return;

    const content = this.postForm.getRawValue().content;

    // Se tem foto, faz o fluxo de 2 etapas (Staging -> Commit)
    if (this.selectedFile) {
      this.postService.uploadImage(this.selectedFile).subscribe({
        next: (response) => {
          // Etapa 2: Commit do Post com a URL da foto
          this.commitPost(content, response.url);
        },
        error: () => this.errorMessage.set('Erro ao enviar imagem. Verifique se é um JPG/PNG válido de até 5MB.')
      });
    } else {
      // Post apenas de texto
      this.commitPost(content);
    }
  }

  private commitPost(content: string, imageUrl?: string) {
    this.postService.createPost(content, imageUrl).subscribe({
      next: () => {
        this.postForm.reset();
        this.selectedFile = null;
        this.loadFeed(); // Recarrega o feed para exibir o novo post
      },
      error: () => this.errorMessage.set('Erro ao criar a publicação.')
    });
  }

  toggleLike(post: Post) {
    // 1. Atualização Otimista: A interface muda no exato milissegundo do clique
    const previousState = post.hasLiked;
    post.hasLiked = !post.hasLiked;
    post.likesCount += post.hasLiked ? 1 : -1;

    // 2. Chama a API em background
    this.postService.toggleLike(post.id).subscribe({
      next: () => {
        // Sucesso silencioso, a interface já está atualizada
      },
      error: (err) => {
        // 3. Rollback: Se o servidor rejeitar (ex: caiu a rede ou tomou 429), desfazemos a ação na tela
        post.hasLiked = previousState;
        post.likesCount += post.hasLiked ? 1 : -1;

        if (err.status === 429) {
          console.warn('Você está curtindo rápido demais!');
        }
      }
    });
  }

  toggleComments(postId: string) {
    const currentExpanded = this.expandedComments();
    const isExpanded = !currentExpanded[postId];

    // Se abriu e ainda não tem cache dos comentários, busca na API
    if (isExpanded && !this.postComments()[postId]) {
      this.postService.getComments(postId).subscribe({
        next: (comments) => {
          this.postComments.set({ ...this.postComments(), [postId]: comments });
        },
        error: () => console.error('Erro ao buscar comentários')
      });
    }
  }

  // Método para enviar comentário (Usamos a referência do input HTML direto para máxima performance)
  submitComment(post: Post, inputElement: HTMLInputElement) {
    const content = inputElement.value.trim();
    if (!content) return;

    this.postService.addComment(post.id, content).subscribe({
      next: (newComment) => {
        // 1. Atualiza a lista de comentários daquele post (Optimistic UI)
        const currentComments = this.postComments()[post.id] || [];
        this.postComments.set({ ...this.postComments(), [post.id]: [...currentComments, newComment] });

        // 2. Aumenta o contador do post
        post.commentsCount = (post.commentsCount || 0) + 1;

        // 3. Limpa o input
        inputElement.value = '';
      },
      error: () => alert('Erro ao enviar comentário.')
    });
  }
}
