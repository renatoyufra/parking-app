import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Vehicle, VehicleType, VehicleRates } from '../models/parking.models';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ExpensesService } from './expenses.service';
import { isPlatformBrowser } from '@angular/common';

const API_URL = 'http://localhost:4000';

const DEFAULT_RATES: VehicleRates = {
  auto: { firstHour: 1000, secondHour: 800, toleranceMinutes: 10, prepaid12Night: 5000, prepaid24Hours: 8000 },
  camioneta: { firstHour: 1500, secondHour: 1200, toleranceMinutes: 10, prepaid12Night: 7500, prepaid24Hours: 12000 },
  camion: { firstHour: 2500, secondHour: 2000, toleranceMinutes: 10, prepaid12Night: 12500, prepaid24Hours: 20000 }
};

@Injectable({ providedIn: 'root' })
export class ParkingService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private expenses = inject(ExpensesService);
  private platformId = inject(PLATFORM_ID);
  
  private vehiclesSig = signal<Vehicle[]>([]);
  private ratesSig = signal<VehicleRates>(DEFAULT_RATES);

  vehicles = this.vehiclesSig.asReadonly();
  rates = this.ratesSig.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId) && this.auth.isAuthenticated()) {
      this.loadVehicles();
      this.loadRates();
    }
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
      isSubscriber: Boolean(v.is_subscriber),
      ticketNumber: v.ticket_number,
      prepaidType: v.prepaid_type,
      prepaidPaid: v.prepaid_paid
    };
  }

  // ... (existing code)

  async updateTicketNumber(id: string, ticketNumber: string): Promise<void> {
    try {
      await firstValueFrom(this.http.put(`${API_URL}/vehicles/${id}/ticket-number`, { ticketNumber }));
      this.vehiclesSig.update(vehicles => 
        vehicles.map(v => v.id === id ? { ...v, ticketNumber } : v)
      );
    } catch (e) {
      console.error('Error updating ticket number', e);
    }
  }

  async loadVehicles() {
    if (!isPlatformBrowser(this.platformId) || !this.auth.isAuthenticated()) return;
    try {
      const rawVehicles = await firstValueFrom(this.http.get<any[]>(`${API_URL}/vehicles`));
      const vehicles = rawVehicles.map(v => this.mapVehicle(v));
      this.vehiclesSig.set(vehicles);
    } catch (e) {
      console.error('Error loading vehicles', e);
    }
  }

  async loadRates() {
    if (!isPlatformBrowser(this.platformId) || !this.auth.isAuthenticated()) return;
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

  async checkIn(type: VehicleType, plate?: string, prepaidType?: string, prepaidPaid?: number): Promise<Vehicle> {
    const rawVehicle = await firstValueFrom(this.http.post<any>(`${API_URL}/vehicles/check-in`, { type, plate, prepaidType, prepaidPaid }));
    const vehicle = this.mapVehicle(rawVehicle);
    this.vehiclesSig.update(v => [...v, vehicle]);
    this.expenses.loadSummary(); // Refrescar contador de estacionados si el summary lo usa
    return vehicle;
  }

  async checkOut(id: string, paymentAmount?: number): Promise<{ vehicle: Vehicle, exitInfo: { duration: number, fee: number } }> {
    const result = await firstValueFrom(this.http.post<any>(`${API_URL}/vehicles/check-out`, { id, paymentAmount }));
    
    // Mapear el vehículo devuelto también
    const vehicle = this.mapVehicle(result.vehicle);
    
    this.vehiclesSig.update(v => v.filter(item => item.id !== id));
    this.expenses.loadSummary(); // Refrescar ingresos en dashboard
    
    return {
      vehicle,
      exitInfo: result.exitInfo
    };
  }

  async deleteVehicle(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/vehicles/${id}`));
    this.vehiclesSig.update(v => v.filter(item => item.id !== id));
    this.expenses.loadSummary();
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
    
    // Caso de prepago
    if (vehicle.prepaidType && vehicle.prepaidType !== 'none' && vehicle.prepaidPaid) {
      let prepaidMinutes = 0;
      if (vehicle.prepaidType === '12night') {
        prepaidMinutes = 12 * 60; // 12 horas
      } else if (vehicle.prepaidType === '24hours') {
        prepaidMinutes = 24 * 60; // 24 horas
      }
      
      if (durationMinutes <= prepaidMinutes) {
        return { durationMinutes, totalFee: vehicle.prepaidPaid };
      } else {
        // Calcular tarifas normales para el tiempo extra
        const extraMinutes = durationMinutes - prepaidMinutes;
        let extraFee = 0;
        
        if (extraMinutes > 0) {
          if (extraMinutes <= 60) {
            extraFee = vehicleRates.firstHour;
          } else {
            extraFee = vehicleRates.firstHour;
            let remainingExtraMinutes = extraMinutes - 60;
            while (remainingExtraMinutes > 0) {
              if (remainingExtraMinutes > vehicleRates.toleranceMinutes) {
                extraFee += vehicleRates.secondHour;
              }
              remainingExtraMinutes -= 60;
            }
          }
        }
        
        return { durationMinutes, totalFee: vehicle.prepaidPaid + extraFee };
      }
    }
    
    // Caso normal (sin prepago)
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
