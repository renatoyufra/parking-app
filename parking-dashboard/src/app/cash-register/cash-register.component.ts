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

  expenseForm = this.fb.group({
    description: ['', Validators.required],
    amount: [null, [Validators.required, Validators.min(0.1)]]
  });

  constructor() {
    this.expensesService.loadSummary();
    this.expensesService.loadExpenses();
  }

  toggleForm() {
    this.showExpenseForm.update(v => !v);
  }

  submitExpense() {
    if (this.expenseForm.invalid) return;

    const { description, amount } = this.expenseForm.value;
    
    this.expensesService.addExpense({
      description: description!,
      amount: Number(amount),
      // category_id pendiente
    });

    this.expenseForm.reset();
    this.showExpenseForm.set(false);
  }
}
