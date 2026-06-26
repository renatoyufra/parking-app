import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vehicle, PrepaidType } from '../../models/parking.models';
import { CURRENCY_SYMBOL } from '../../config';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-parked-vehicles-list',
  standalone: true,
  imports: [CommonModule, ConfirmModalComponent],
  templateUrl: './parked-vehicles-list.component.html',
  styleUrls: ['./parked-vehicles-list.component.scss'],
})
export class ParkedVehiclesListComponent {
  vehicles = input.required<Vehicle[]>();
  displayMode = input<'cards' | 'table'>('cards');
  title = input<string>('Vehículos estacionados');

  onCheckOut = output<string>();
  onReprintTicket = output<Vehicle>();
  onDelete = output<string>();
  currency = CURRENCY_SYMBOL;

  // Modal state for delete
  showConfirmDelete = signal(false);
  vehicleToDelete = signal<string | null>(null);

  getPrepaidLabel(type?: PrepaidType): string {
    switch (type) {
      case '12night': return '12h Nocturnas';
      case '24hours': return '24h Completo';
      default: return 'Tarifa Normal';
    }
  }

  requestDeleteVehicle(id: string) {
    this.vehicleToDelete.set(id);
    this.showConfirmDelete.set(true);
  }

  confirmDeleteVehicle() {
    const id = this.vehicleToDelete();
    if (id) {
      this.onDelete.emit(id);
    }
    this.closeModal();
  }

  closeModal() {
    this.showConfirmDelete.set(false);
    this.vehicleToDelete.set(null);
  }
}
