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
    prepaidType: this.fb.control<string>('none', { nonNullable: true }),
    prepaidPaid: this.fb.control<number>(0, { nonNullable: true }),
  });

  vehicleTypes: VehicleType[] = ['auto', 'camioneta', 'camion'];
  prepaidOptions = [
    { value: 'none', label: 'Sin Prepago', price: 0 },
    { value: '12night', label: 'Prepago 12 Horas Nocturnas', priceKey: 'prepaid12Night' },
    { value: '24hours', label: 'Prepago 24 Horas', priceKey: 'prepaid24Hours' }
  ];

  checkSubscriber() {
    const plate = this.form.get('plate')?.value;
    if (plate) {
      const sub = this.subService.getSubscriber(plate.trim().toUpperCase());
      if (sub) {
        this.foundSubscriber.set(sub);
        this.form.patchValue({ type: sub.type });
      } else {
        this.foundSubscriber.set(null);
      }
    }
  }

  getPrepaidPrice(type: string): number {
    const vehicleType = this.form.get('type')?.value;
    if (!vehicleType) return 0;
    const rates = this.parking.rates()[vehicleType];
    if (type === '12night') return rates.prepaid12Night;
    if (type === '24hours') return rates.prepaid24Hours;
    return 0;
  }

  onPrepaidChange() {
    const prepaidType = this.form.get('prepaidType')?.value;
    if (prepaidType && prepaidType !== 'none') {
      const price = this.getPrepaidPrice(prepaidType);
      this.form.patchValue({ prepaidPaid: price });
    } else {
      this.form.patchValue({ prepaidPaid: 0 });
    }
  }

  async submit() {
    const { type, plate, prepaidType, prepaidPaid } = this.form.getRawValue();
    if (!type) return;
    this.submitting.set(true);
    try {
      const v = await this.parking.checkIn(
        type, 
        plate?.trim().toUpperCase() || undefined,
        prepaidType,
        prepaidPaid
      );
      this.lastVehicle.set(v);
      this.success.set(`Registrado: ${v.type.toUpperCase()} ${v.plate ?? ''}`.trim());
      this.form.patchValue({ plate: '', prepaidType: 'none', prepaidPaid: 0 });
      this.foundSubscriber.set(null);
      
      // Impresión nativa (Node.js)
      const printResult = await this.printer.printTicket(v, 'entry');
      if (printResult.success && printResult.ticketNumber) {
        await this.parking.updateTicketNumber(v.id, printResult.ticketNumber);
        // Actualizar el objeto local para que se muestre en el ticket visual si es necesario
        v.ticketNumber = printResult.ticketNumber;
        this.lastVehicle.set({ ...v });
      }
      
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
