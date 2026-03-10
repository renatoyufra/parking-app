import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Vehicle, VehicleType, VehicleRates } from '../models/parking.models';
import { firstValueFrom } from 'rxjs';

const API_URL = 'http://localhost:4000';

const DEFAULT_RATES: VehicleRates = {
  auto: { firstHour: 1000, secondHour: 800, toleranceMinutes: 10 },
  camioneta: { firstHour: 1500, secondHour: 1200, toleranceMinutes: 10 },
  camion: { firstHour: 2500, secondHour: 2000, toleranceMinutes: 10 }
};

@Injectable({ providedIn: 'root' })
export class ParkingService {
  private http = inject(HttpClient);
  
  private vehiclesSig = signal<Vehicle[]>([]);
  private ratesSig = signal<VehicleRates>(DEFAULT_RATES);

  vehicles = this.vehiclesSig.asReadonly();
  rates = this.ratesSig.asReadonly();

  constructor() {
    this.loadVehicles();
    this.loadRates();
  }

  // Helper para transformar snake_case (DB) a camelCase (Frontend)
  private mapVehicle(v: any): Vehicle {
    return {
      id: v.id,
      plate: v.plate,
      type: v.type,
      // La BD devuelve 'entry_time' en UTC string
      checkedInAt: new Date(v.entry_time), 
      // La BD devuelve 'is_subscriber' (0 o 1)
      isSubscriber: Boolean(v.is_subscriber)
    };
  }

  async loadVehicles() {
    try {
      const rawVehicles = await firstValueFrom(this.http.get<any[]>(`${API_URL}/vehicles`));
      const vehicles = rawVehicles.map(v => this.mapVehicle(v));
      this.vehiclesSig.set(vehicles);
    } catch (e) {
      console.error('Error loading vehicles', e);
    }
  }

  async loadRates() {
    try {
      const rates = await firstValueFrom(this.http.get<VehicleRates>(`${API_URL}/rates`));
      if (rates && Object.keys(rates).length > 0) {
        this.ratesSig.set(rates);
      }
    } catch (e) {
      console.error('Error loading rates', e);
    }
  }

  async updateRates(newRates: VehicleRates) {
    try {
      await firstValueFrom(this.http.put(`${API_URL}/rates`, newRates));
      this.ratesSig.set(newRates);
    } catch (e) {
      console.error('Error updating rates', e);
    }
  }

  async checkIn(type: VehicleType, plate?: string): Promise<Vehicle> {
    const rawVehicle = await firstValueFrom(this.http.post<any>(`${API_URL}/vehicles/check-in`, { type, plate }));
    const vehicle = this.mapVehicle(rawVehicle);
    this.vehiclesSig.update(v => [...v, vehicle]);
    return vehicle;
  }

  async checkOut(id: string): Promise<{ vehicle: Vehicle, exitInfo: { duration: number, fee: number } }> {
    const result = await firstValueFrom(this.http.post<any>(`${API_URL}/vehicles/check-out`, { id }));
    
    // Mapear el vehículo devuelto también
    const vehicle = this.mapVehicle(result.vehicle);
    
    this.vehiclesSig.update(v => v.filter(item => item.id !== id));
    
    return {
      vehicle,
      exitInfo: result.exitInfo
    };
  }

  // Método auxiliar para obtener datos de salida sin procesar el cobro (pre-cálculo)
  calculateFee(vehicle: Vehicle): { durationMinutes: number, totalFee: number } {
    // Este cálculo es local para mostrar en la UI antes de confirmar, 
    // pero la verdad absoluta la tiene el backend al hacer check-out.
    // Replicamos la lógica del backend para consistencia visual.
    
    const now = new Date();
    const checkedInAt = new Date(vehicle.checkedInAt);
    const durationMs = now.getTime() - checkedInAt.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    
    if (vehicle.isSubscriber) {
      return { durationMinutes, totalFee: 0 };
    }

    const vehicleRates = this.rates()[vehicle.type];
    
    if (durationMinutes === 0) {
      return { durationMinutes, totalFee: 0 };
    }

    if (durationMinutes <= 60) {
      return { durationMinutes, totalFee: vehicleRates.firstHour };
    }

    let totalFee = vehicleRates.firstHour;
    let remainingMinutes = durationMinutes - 60;

    while (remainingMinutes > 0) {
      if (remainingMinutes > vehicleRates.toleranceMinutes) {
        totalFee += vehicleRates.secondHour;
      }
      remainingMinutes -= 60;
    }

    return { durationMinutes, totalFee };
  }
}
