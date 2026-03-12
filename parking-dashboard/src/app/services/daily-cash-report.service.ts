import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API_URL = 'http://localhost:4000';

export interface CashMovementRow {
  id: number;
  vehicle_id: string;
  plate?: string | null;
  vehicle_type: string;
  entry_time: string;
  exit_time: string;
  duration_minutes?: number | null;
  amount_paid?: number | null;
  is_subscriber?: number | boolean | null;
  payment_method?: string | null;
}

export interface CashExpenseRow {
  id: number;
  category_id?: number | null;
  description?: string | null;
  amount: number;
  created_at?: string;
}

export interface DailyCashReport {
  date: string;
  opening_balance: number;
  income_total: number;
  expenses_total: number;
  balance: number;
  expected_cash: number;
  movements: CashMovementRow[];
  expenses: CashExpenseRow[];
}

@Injectable({ providedIn: 'root' })
export class DailyCashReportService {
  private http = inject(HttpClient);

  private reportSig = signal<DailyCashReport | null>(null);
  report = this.reportSig.asReadonly();

  private loadingSig = signal(false);
  loading = this.loadingSig.asReadonly();

  private errorSig = signal<string | null>(null);
  error = this.errorSig.asReadonly();

  async loadReport(date?: string) {
    this.loadingSig.set(true);
    this.errorSig.set(null);
    try {
      const url = date ? `${API_URL}/daily-cash-report?date=${encodeURIComponent(date)}` : `${API_URL}/daily-cash-report`;
      const data = await firstValueFrom(this.http.get<DailyCashReport>(url));
      this.reportSig.set(data);
    } catch (e) {
      console.error('Error loading daily cash report', e);
      this.errorSig.set('No se pudo cargar el reporte');
      this.reportSig.set(null);
    } finally {
      this.loadingSig.set(false);
    }
  }
}
