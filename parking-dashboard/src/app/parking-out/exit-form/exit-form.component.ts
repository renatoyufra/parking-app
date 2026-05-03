import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ParkingService } from '../../services/parking.service';
import { PrintService } from '../../services/print.service';
import { SubscribersService } from '../../services/subscribers.service';
import { Vehicle, Subscriber } from '../../models/parking.models';
import { Subscription } from 'rxjs';
import { CURRENCY_SYMBOL } from '../../config';
import { DurationPipe } from '../../pipes/duration.pipe';

@Component({
  selector: 'app-exit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, DurationPipe],
  templateUrl: './exit-form.component.html',
  styleUrls: ['./exit-form.component.scss']
})
export class ExitFormComponent implements OnInit, OnDestroy {
  private parking = inject(ParkingService);
  private printer = inject(PrintService);
  private subService = inject(SubscribersService);
  private route = inject(ActivatedRoute);
  
  currency = CURRENCY_SYMBOL;
  qrInput = '';
  foundVehicle = signal<Vehicle | null>(null);
  foundSubscriber = signal<Subscriber | null>(null);
  exitInfo = signal<{ duration: number, fee: number } | null>(null);
  paymentAmount = signal<number>(0);
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
    this.foundSubscriber.set(null);
    this.paymentAmount.set(0);

    const id = this.qrInput.trim().toUpperCase();
    this.qrInput = id;
    const vehicle = this.parking.vehicles().find(v => v.id === id);
    
    if (vehicle) {
      this.foundVehicle.set(vehicle);
      const { durationMinutes, totalFee } = this.parking.calculateFee(vehicle);
      this.exitInfo.set({ duration: durationMinutes, fee: totalFee });

      if (vehicle.isSubscriber && vehicle.plate) {
        const sub = this.subService.getSubscriber(vehicle.plate);
        if (sub) {
          this.foundSubscriber.set(sub);
          this.paymentAmount.set(sub.balanceDue);
        }
      }
    } else {
      this.foundVehicle.set(null);
      this.error.set('Vehículo no encontrado. Verifique el código.');
    }
  }

  confirmExit() {
    const vehicle = this.foundVehicle();
    const info = this.exitInfo();

    if (vehicle && info) {
      const finalFee = vehicle.isSubscriber ? this.paymentAmount() : info.fee;
      
      // Impresión nativa de salida
      this.printer.printTicket(vehicle, 'exit', { ...info, fee: finalFee });
      
      this.parking.checkOut(vehicle.id, finalFee);
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
