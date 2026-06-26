import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParkingService } from '../services/parking.service';
import { VehicleType, Vehicle } from '../models/parking.models';
import { EntryFormComponent } from '../parking-in/entry-form/entry-form.component';
import { ExitFormComponent } from '../parking-out/exit-form/exit-form.component';
import { ExpensesService } from '../services/expenses.service';
import { CURRENCY_SYMBOL } from '../config';
import { ParkedVehiclesListComponent } from '../parking-in/parked-vehicles-list/parked-vehicles-list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, EntryFormComponent, ExitFormComponent, ParkedVehiclesListComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private parking = inject(ParkingService);
  private expensesService = inject(ExpensesService);

  // Sidebar UI state without Material
  sidebarOpen = signal(true);
  toggleSidebar() {
    this.sidebarOpen.update((v: boolean) => !v);
  }

  // Data signals
  data = this.parking.vehicles;
  total = computed(() => this.data().length);
  byType = computed(() => {
    const result: Record<VehicleType, number> = { auto: 0, camioneta: 0, camion: 0 };
    for (const v of this.data()) result[v.type]++;
    return result;
  });

  payableCount = computed(() => this.data().filter((v) => !v.isSubscriber).length);

  summary = this.expensesService.summary;
  currency = CURRENCY_SYMBOL;

  constructor() {
    this.expensesService.loadSummary();
  }

  async handleDeleteVehicle(id: string) {
    await this.parking.deleteVehicle(id);
  }

  handleReprintTicket(vehicle: Vehicle) {
    // If needed, add reprint logic here
  }
}
