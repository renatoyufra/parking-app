import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ParkingService } from '../../services/parking.service';
import { PrintService } from '../../services/print.service';
import { Vehicle } from '../../models/parking.models';
import { Subscription } from 'rxjs';
import { CURRENCY_SYMBOL } from '../../config';

@Component({
  selector: 'app-exit-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exit-form.component.html',
  styleUrls: ['./exit-form.component.scss']
})
export class ExitFormComponent implements OnInit, OnDestroy {
  private parking = inject(ParkingService);
  private printer = inject(PrintService);
  private route = inject(ActivatedRoute);
  
  currency = CURRENCY_SYMBOL;
  qrInput = '';
  foundVehicle = signal<Vehicle | null>(null);
  exitInfo = signal<{ duration: number, fee: number } | null>(null);
  error = signal<string | null>(null);
  now = new Date();
  private routeSub?: Subscription;

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      const vehicleId = params['id'];
      if (vehicleId) {
        this.qrInput = vehicleId;
        this.searchVehicle();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  searchVehicle() {
    this.error.set(null);
    this.exitInfo.set(null);
    const vehicle = this.parking.vehicles().find(v => v.id === this.qrInput.trim());
    
    if (vehicle) {
      this.foundVehicle.set(vehicle);
      const { durationMinutes, totalFee } = this.parking.calculateFee(vehicle);
      this.exitInfo.set({ duration: durationMinutes, fee: totalFee });
    } else {
      this.foundVehicle.set(null);
      this.error.set('Vehículo no encontrado. Verifique el código.');
    }
  }

  confirmExit() {
    if (this.foundVehicle() && this.exitInfo()) {
      // Impresión nativa de salida
      this.printer.printTicket(this.foundVehicle()!, 'exit', this.exitInfo()!);
      
      this.parking.checkOut(this.foundVehicle()!.id);
      this.reset();
    }
  }

  reset() {
    this.qrInput = '';
    this.foundVehicle.set(null);
    this.exitInfo.set(null);
    this.error.set(null);
  }
}
