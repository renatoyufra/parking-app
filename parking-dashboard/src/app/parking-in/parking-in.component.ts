import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParkingService } from '../services/parking.service';
import { PrintService } from '../services/print.service';
import { Vehicle } from '../models/parking.models';
import { RelojComponent } from "../reloj/reloj";
import { EntryFormComponent } from './entry-form/entry-form.component';
import { ParkedVehiclesListComponent } from './parked-vehicles-list/parked-vehicles-list.component';

@Component({
  selector: 'app-parking-in',
  standalone: true,
  imports: [CommonModule, RelojComponent, EntryFormComponent, ParkedVehiclesListComponent],
  templateUrl: './parking-in.component.html',
  styleUrls: ['./parking-in.component.scss'],
})
export class ParkingInComponent {
  private parking = inject(ParkingService);
  private printer = inject(PrintService);
  private router = inject(Router);

  vehicles = this.parking.vehicles;

  checkOut(id: string) {
    this.router.navigate(['/salida'], { queryParams: { id } });
  }

  reprintTicket(v: Vehicle) {
    this.printer.printTicket(v, 'entry');
  }

  async handleDeleteVehicle(id: string) {
    await this.parking.deleteVehicle(id);
  }
}