import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="cancel()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>Confirmar acción</h3>
        <p>Para eliminar este registro, ingrese la clave de seguridad.</p>
        
        <div class="field">
          <label>Clave de seguridad</label>
          <input 
            type="password" 
            [(ngModel)]="password" 
            placeholder="••••" 
            (keyup.enter)="confirm()"
            autofocus
          />
        </div>

        @if (error()) {
          <div class="error-msg">{{ error() }}</div>
        }

        <div class="actions">
          <button class="btn secondary" (click)="cancel()">Cancelar</button>
          <button class="btn danger" (click)="confirm()" [disabled]="!password()">Eliminar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }
    .modal-content {
      background: #fff;
      padding: 2rem;
      border-radius: 12px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      animation: slideUp 0.2s ease-out;
    }
    h3 { margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.25rem; }
    p { color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem; }
    
    .field {
      display: flex; flex-direction: column; gap: 8px; margin-bottom: 1rem;
      label { font-size: 0.85rem; font-weight: 700; color: #374151; }
      input {
        padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1.25rem;
        text-align: center; letter-spacing: 0.5rem;
        &:focus { border-color: #2563eb; outline: none; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
      }
    }
    
    .error-msg { color: #dc2626; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; text-align: center; }
    
    .actions { display: flex; gap: 12px; margin-top: 1.5rem;
      .btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
      .secondary { background: #f1f5f9; color: #475569; &:hover { background: #e2e8f0; } }
      .danger { background: #ef4444; color: #fff; &:hover { background: #dc2626; } &:disabled { opacity: 0.5; cursor: not-allowed; } }
    }

    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ConfirmModalComponent {
  password = signal('');
  error = signal<string | null>(null);
  
  onConfirm = output<void>();
  onCancel = output<void>();

  confirm() {
    if (this.password() === '3010') {
      this.onConfirm.emit();
    } else {
      this.error.set('Clave incorrecta');
      this.password.set('');
    }
  }

  cancel() {
    this.onCancel.emit();
  }
}
