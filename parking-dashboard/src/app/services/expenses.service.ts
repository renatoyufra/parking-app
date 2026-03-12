import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API_URL = 'http://localhost:4000';

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category_id?: number;
  created_at?: string;
}

export interface DailySummary {
  date: string;
  income: number;
  expenses: number;
  balance: number;
  movements_count: number;
  opening_balance: number;
  expected_cash: number;
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);
  
  private expensesSig = signal<Expense[]>([]);
  expenses = this.expensesSig.asReadonly();

  private summarySig = signal<DailySummary | null>(null);
  summary = this.summarySig.asReadonly();

  constructor() {
    this.loadExpenses();
    this.loadSummary();
  }

  async loadExpenses() {
    try {
      const data = await firstValueFrom(this.http.get<Expense[]>(`${API_URL}/expenses`));
      this.expensesSig.set(data);
    } catch (e) {
      console.error('Error loading expenses', e);
    }
  }

  async loadSummary() {
    try {
      const data = await firstValueFrom(this.http.get<DailySummary>(`${API_URL}/daily-summary`));
      this.summarySig.set(data);
    } catch (e) {
      console.error('Error loading summary', e);
    }
  }

  async setOpeningBalance(openingBalance: number) {
    try {
      await firstValueFrom(
        this.http.put(`${API_URL}/cash/opening`, { opening_balance: openingBalance })
      );
      await this.loadSummary();
    } catch (e) {
      console.error('Error setting opening balance', e);
      throw e;
    }
  }

  async addExpense(expense: Omit<Expense, 'id'>) {
    try {
      const newExpense = await firstValueFrom(this.http.post<Expense>(`${API_URL}/expenses`, expense));
      this.expensesSig.update(list => [...list, newExpense]);
      this.loadSummary(); // Actualizar el cuadre
    } catch (e) {
      console.error('Error adding expense', e);
      throw e;
    }
  }
}
