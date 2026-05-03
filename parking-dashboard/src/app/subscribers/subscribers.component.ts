import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SubscribersService } from '../services/subscribers.service';
import { VehicleType } from '../models/parking.models';

@Component({
  selector: 'app-subscribers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './subscribers.component.html',
  styleUrls: ['./subscribers.component.scss']
})
export class SubscribersComponent {
  private fb = inject(FormBuilder);
  private subService = inject(SubscribersService);

  subscribers = this.subService.subscribers;
  showForm = signal(false);
  editingId = signal<string | null>(null);
  
  form = this.fb.group({
    name: ['', Validators.required],
    plate: ['', Validators.required],
    type: ['auto' as VehicleType, Validators.required],
    startDate: [new Date().toISOString().split('T')[0], Validators.required],
    endDate: ['', Validators.required],
    monthlyFee: [0, [Validators.required, Validators.min(0)]],
    balanceDue: [0, [Validators.required, Validators.min(0)]]
  });

  vehicleTypes: VehicleType[] = ['auto', 'camioneta', 'camion'];

  toggleForm() {
    if (this.showForm()) {
      this.cancelEdit();
    } else {
      this.showForm.set(true);
    }
  }

  private formatDateForInput(dateInput: any): string {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      // Si ya es un string YYYY-MM-DD, devolverlo tal cual
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
        return dateInput.split('T')[0];
      }
      return '';
    }
    return d.toISOString().split('T')[0];
  }

  edit(sub: any) {
    this.editingId.set(sub.id);
    this.form.patchValue({
      name: sub.name,
      plate: sub.plate,
      type: sub.type,
      startDate: this.formatDateForInput(sub.startDate),
      endDate: this.formatDateForInput(sub.endDate),
      monthlyFee: sub.monthlyFee,
      balanceDue: sub.balanceDue
    });
    this.showForm.set(true);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.form.reset({
      type: 'auto',
      startDate: new Date().toISOString().split('T')[0],
      monthlyFee: 0,
      balanceDue: 0
    });
    this.showForm.set(false);
  }

  submit() {
    if (this.form.invalid) return;
    
    const val = this.form.getRawValue();
    const subData = {
      name: val.name || '',
      plate: (val.plate || '').toUpperCase(),
      type: (val.type as VehicleType) || 'auto',
      startDate: new Date(val.startDate || new Date()),
      endDate: new Date(val.endDate || new Date()),
      monthlyFee: Number(val.monthlyFee || 0),
      balanceDue: Number(val.balanceDue || 0),
      active: true
    };

    if (this.editingId()) {
      this.subService.updateSubscriber(this.editingId()!, subData);
    } else {
      this.subService.addSubscriber(subData);
    }

    this.cancelEdit();
  }

  delete(id: string) {
    if (confirm('¿Estás seguro de eliminar este abonado?')) {
      this.subService.deleteSubscriber(id);
    }
  }
}
