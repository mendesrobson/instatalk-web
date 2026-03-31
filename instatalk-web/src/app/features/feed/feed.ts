import { Component, inject, OnInit, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PostService, Post } from '../../core/services/post';
import { DatePipe, NgClass } from '@angular/common';

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

  // A base URL do backend para renderizar as imagens estáticas
  readonly apiBaseUrl = 'http://localhost:5027';

  posts = signal<Post[]>([]);
  errorMessage = signal<string>('');

  // Controle do arquivo selecionado
  selectedFile: File | null = null;

  // Formulário estritamente tipado (Defense in Depth no frontend)
  postForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(500)]]
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFeed();
    }
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
}
