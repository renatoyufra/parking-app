import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DailyCashReportService } from '../services/daily-cash-report.service';
import { PrintService } from '../services/print.service';
import { CURRENCY_SYMBOL } from '../config';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.scss']
})
export class MovementsComponent implements OnInit {
  private reportService = inject(DailyCashReportService);
  private printer = inject(PrintService);
  private platformId = inject(PLATFORM_ID);

  currency = CURRENCY_SYMBOL;
  report = this.reportService.report;
  printing = signal(false);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.reportService.loadReport();
    }
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

  asTime(value?: string | null): string {
    if (!value) return '--:--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
