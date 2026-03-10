import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscriber, VehicleType } from '../models/parking.models';
import { firstValueFrom } from 'rxjs';

const API_URL = 'http://localhost:4000';

@Injectable({ providedIn: 'root' })
export class SubscribersService {
  private http = inject(HttpClient);
  
  private subscribersSig = signal<Subscriber[]>([]);
  subscribers = this.subscribersSig.asReadonly();

  constructor() {
    this.loadSubscribers();
  }

  async loadSubscribers() {
    try {
      const subs = await firstValueFrom(this.http.get<Subscriber[]>(`${API_URL}/subscribers`));
      this.subscribersSig.set(subs);
    } catch (e) {
      console.error('Error loading subscribers', e);
    }
  }

  async addSubscriber(sub: Omit<Subscriber, 'id'>) {
    try {
      const newSub = await firstValueFrom(this.http.post<Subscriber>(`${API_URL}/subscribers`, sub));
      this.subscribersSig.update(list => [...list, newSub]);
    } catch (e) {
      console.error('Error adding subscriber', e);
    }
  }

  async deleteSubscriber(id: string) {
    try {
      await firstValueFrom(this.http.delete(`${API_URL}/subscribers/${id}`));
      this.subscribersSig.update(list => list.filter(s => s.id !== id));
    } catch (e) {
      console.error('Error deleting subscriber', e);
    }
  }

  getSubscriber(plate: string): Subscriber | undefined {
    if (!plate) return undefined;
    const now = new Date();
    // La lista ya está cargada en memoria, filtramos localmente para rapidez en UI
    return this.subscribersSig().find(s => 
      s.plate.toUpperCase() === plate.toUpperCase() && 
      Boolean(s.active) &&
      new Date(s.endDate) > now
    );
  }

  // Método auxiliar síncrono si ya tenemos los datos cargados
  isSubscriber(plate: string): boolean {
    return !!this.getSubscriber(plate);
  }
}

