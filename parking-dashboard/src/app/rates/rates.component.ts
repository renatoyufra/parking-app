import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ParkingService } from '../services/parking.service';
import { VehicleType, VehicleRates } from '../models/parking.models';
import { CURRENCY_SYMBOL } from '../config';

@Component({
  selector: 'app-rates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rates.component.html',
  styleUrls: ['./rates.component.scss']
})
export class RatesComponent {
  private fb = inject(FormBuilder);
  private parking = inject(ParkingService);
  
  currency = CURRENCY_SYMBOL;
  vehicleTypes: VehicleType[] = ['auto', 'camioneta', 'camion'];
  ratesForm: FormGroup;
  success = signal<string | null>(null);

  constructor() {
    const currentRates = this.parking.rates();
    
    // Crear un grupo de formularios dinámico para cada tipo de vehículo
    const group: any = {};
    this.vehicleTypes.forEach(type => {
      group[type] = this.fb.group({
        firstHour: [currentRates[type].firstHour],
        secondHour: [currentRates[type].secondHour],
        toleranceMinutes: [currentRates[type].toleranceMinutes]
      });
    });
    
    this.ratesForm = this.fb.group(group);
  }

  save() {
    const newRates = this.ratesForm.value as VehicleRates;
    this.parking.updateRates(newRates);
    this.success.set('Tarifas actualizadas correctamente');
    
    setTimeout(() => {
      this.success.set(null);
    }, 3000);
  }
}
