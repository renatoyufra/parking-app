import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DailyCashReportService } from '../services/daily-cash-report.service';
import { PrintService } from '../services/print.service';
import { ExpensesService } from '../services/expenses.service';
import { ConfirmModalComponent } from '../shared/components/confirm-modal/confirm-modal.component';
import { CURRENCY_SYMBOL } from '../config';
import { DurationPipe } from '../pipes/duration.pipe';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, DurationPipe, ConfirmModalComponent],
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.scss']
})
export class MovementsComponent implements OnInit {
  private reportService = inject(DailyCashReportService);
  private printer = inject(PrintService);
  private expensesService = inject(ExpensesService);
  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  currency = CURRENCY_SYMBOL;
  report = this.reportService.report;
  loading = this.reportService.loading;
  error = this.reportService.error;
  printing = signal(false);
  selectedDate = signal<string>('');

  // Modal state
  showConfirmDelete = signal(false);
  itemToDelete = signal<{ id: number, type: 'movement' | 'expense' } | null>(null);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const initial =
        typeof this.route.snapshot.queryParamMap.get('date') === 'string'
          ? this.route.snapshot.queryParamMap.get('date')!
          : this.localDateString();
      const date = initial || this.localDateString();
      this.selectedDate.set(date);
      this.reportService.loadReport(date);
    }
  }

  async loadForSelectedDate() {
    const date = (this.selectedDate() || '').trim();
    if (!date) return;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    await this.reportService.loadReport(date);
  }

  onDateChange(value: string) {
    this.selectedDate.set(value);
    this.loadForSelectedDate();
  }

  async printDailyReport() {
    const r = this.report();
    if (!r) return;
    this.printing.set(true);
    try {
      await this.printer.printCashReport(r);
    } finally {
      this.printing.set(false);
    }
  }

  requestDeleteMovement(id: number) {
    this.itemToDelete.set({ id, type: 'movement' });
    this.showConfirmDelete.set(true);
  }

  requestDeleteExpense(id: number) {
    this.itemToDelete.set({ id, type: 'expense' });
    this.showConfirmDelete.set(true);
  }

  async confirmDelete() {
    const item = this.itemToDelete();
    if (!item) return;

    if (item.type === 'movement') {
      await this.reportService.deleteMovement(item.id);
    } else {
      await this.expensesService.deleteExpense(item.id);
      this.loadForSelectedDate();
    }
    this.closeModal();
  }

  closeModal() {
    this.showConfirmDelete.set(false);
    this.itemToDelete.set(null);
  }

  asTime(value?: string | null): string {
    if (!value) return '--:--';
    // Asegurar formato ISO para navegadores estrictos (Safari)
    const normalized = value.includes(' ') && !value.includes('T')
      ? value.replace(' ', 'T')
      : value;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private localDateString(): string {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
  }
}
