import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ExpensesService } from '../services/expenses.service';
import { CURRENCY_SYMBOL } from '../config';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cash-register.component.html',
  styleUrls: ['./cash-register.component.scss']
})
export class CashRegisterComponent {
  private fb = inject(FormBuilder);
  private expensesService = inject(ExpensesService);

  currency = CURRENCY_SYMBOL;
  summary = this.expensesService.summary;
  expenses = this.expensesService.expenses;
  showExpenseForm = signal(false);
  openingSaving = signal(false);
  openingError = signal<string | null>(null);
  openingSaved = signal(false);
  expenseSaving = signal(false);
  expenseError = signal<string | null>(null);
  expenseSaved = signal(false);

  openingForm = this.fb.group({
    opening_balance: [0, [Validators.required, Validators.min(0)]],
  });

  expenseForm = this.fb.group({
    description: ['', Validators.required],
    amount: [null, [Validators.required, Validators.min(0.1)]]
  });

  constructor() {
    this.init();
  }

  private async init() {
    await Promise.all([this.expensesService.loadSummary(), this.expensesService.loadExpenses()]);
    const s = this.summary();
    if (s) {
      this.openingForm.patchValue({ opening_balance: s.opening_balance ?? 0 }, { emitEvent: false });
    }
  }

  toggleForm() {
    this.showExpenseForm.update(v => !v);
  }

  async saveOpeningBalance() {
    this.openingError.set(null);
    this.openingSaved.set(false);

    if (this.openingForm.invalid) {
      this.openingForm.markAllAsTouched();
      return;
    }

    const openingBalance = Number(this.openingForm.value.opening_balance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      this.openingError.set('Ingrese un monto válido');
      return;
    }

    this.openingSaving.set(true);
    try {
      await this.expensesService.setOpeningBalance(openingBalance);
      const s = this.summary();
      if (s) {
        this.openingForm.patchValue({ opening_balance: s.opening_balance ?? 0 }, { emitEvent: false });
      }
      this.openingSaved.set(true);
      setTimeout(() => this.openingSaved.set(false), 2000);
    } catch (e) {
      this.openingError.set('No se pudo guardar el saldo inicial');
    } finally {
      this.openingSaving.set(false);
    }
  }

  async submitExpense() {
    this.expenseError.set(null);
    this.expenseSaved.set(false);

    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const { description, amount } = this.expenseForm.value;
    const desc = (description || '').trim();
    const amt = Number(amount);

    if (!desc || !Number.isFinite(amt) || amt <= 0) {
      this.expenseError.set('Complete descripción y monto válido');
      return;
    }

    this.expenseSaving.set(true);
    try {
      await this.expensesService.addExpense({
        description: desc,
        amount: amt,
      });
      this.expenseSaved.set(true);
      setTimeout(() => this.expenseSaved.set(false), 2000);
      this.expenseForm.reset();
      this.showExpenseForm.set(false);
    } catch (e) {
      this.expenseError.set('No se pudo registrar el gasto');
    } finally {
      this.expenseSaving.set(false);
    }
  }
}
