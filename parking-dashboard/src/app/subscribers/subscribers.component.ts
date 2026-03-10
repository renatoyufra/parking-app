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
  
  form = this.fb.group({
    name: ['', Validators.required],
    plate: ['', Validators.required],
    type: ['auto' as VehicleType, Validators.required],
    startDate: [new Date().toISOString().split('T')[0], Validators.required],
    endDate: ['', Validators.required]
  });

  vehicleTypes: VehicleType[] = ['auto', 'camioneta', 'camion'];

  toggleForm() {
    this.showForm.update(v => !v);
  }

  submit() {
    if (this.form.invalid) return;
    
    const val = this.form.value;
    
    this.subService.addSubscriber({
      name: val.name!,
      plate: val.plate!.toUpperCase(),
      type: val.type as VehicleType,
      startDate: new Date(val.startDate!),
      endDate: new Date(val.endDate!),
      active: true
    });

    this.form.reset({
      type: 'auto',
      startDate: new Date().toISOString().split('T')[0]
    });
    this.showForm.set(false);
  }

  delete(id: string) {
    if (confirm('¿Estás seguro de eliminar este abonado?')) {
      this.subService.deleteSubscriber(id);
    }
  }
}
