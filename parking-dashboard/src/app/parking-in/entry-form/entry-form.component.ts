import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ParkingService } from '../../services/parking.service';
import { PrintService } from '../../services/print.service';
import { SubscribersService } from '../../services/subscribers.service';
import { VehicleType, Vehicle, Subscriber } from '../../models/parking.models';
import { TicketComponent } from '../ticket/ticket.component';

@Component({
  selector: 'app-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TicketComponent],
  templateUrl: './entry-form.component.html',
  styleUrls: ['./entry-form.component.scss']
})
export class EntryFormComponent {
  private fb = inject(FormBuilder);
  private parking = inject(ParkingService);
  private printer = inject(PrintService);
  private subService = inject(SubscribersService);

  submitting = signal(false);
  success = signal<string | null>(null);
  lastVehicle = signal<Vehicle | null>(null);
  foundSubscriber = signal<Subscriber | null>(null);

  form = this.fb.group({
    type: this.fb.control<VehicleType>('auto', { nonNullable: true, validators: [Validators.required] }),
    plate: this.fb.control<string>('', { nonNullable: true }),
  });

  vehicleTypes: VehicleType[] = ['auto', 'camioneta', 'camion'];

  checkSubscriber() {
    const plate = this.form.get('plate')?.value;
    if (plate) {
      const sub = this.subService.getSubscriber(plate);
      if (sub) {
        this.foundSubscriber.set(sub);
        this.form.patchValue({ type: sub.type });
      } else {
        this.foundSubscriber.set(null);
      }
    }
  }

  async submit() {
    const { type, plate } = this.form.getRawValue();
    if (!type) return;
    this.submitting.set(true);
    try {
      const v = await this.parking.checkIn(type, plate?.trim() || undefined);
      this.lastVehicle.set(v);
      this.success.set(`Registrado: ${v.type.toUpperCase()} ${v.plate ?? ''}`.trim());
      this.form.patchValue({ plate: '' });
      this.foundSubscriber.set(null);
      
      // Impresión nativa (Node.js)
      this.printer.printTicket(v, 'entry');
      
      setTimeout(() => {
        this.success.set(null);
      }, 3000);
      
    } catch (e) {
      console.error(e);
    } finally {
      this.submitting.set(false);
    }
  }
}
