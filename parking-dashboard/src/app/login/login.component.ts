import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  submitting = signal(false);
  error = signal<string | null>(null);
  expired = signal(false);

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(1)]]
  });

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      if (this.auth.isAuthenticated()) {
        await this.router.navigateByUrl('/');
      }
      
      this.route.queryParams.subscribe(params => {
        if (params['expired'] === 'true') {
          this.expired.set(true);
        }
      });
    }
  }

  async submit() {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const password = String(this.form.value.password || '');
    this.submitting.set(true);
    try {
      const ok = await this.auth.login(password);
      if (!ok) {
        this.error.set('Credenciales inválidas');
        return;
      }
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set('No se pudo iniciar sesión');
    } finally {
      this.submitting.set(false);
    }
  }
}
