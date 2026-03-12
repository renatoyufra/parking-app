import { Injectable } from '@angular/core';
import { Vehicle } from '../models/parking.models';

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private apiUrl = 'http://localhost:3000/print-ticket';
  private cashReportUrl = 'http://localhost:3000/print-cash-report';

  async printTicket(vehicle: Vehicle, type: 'entry' | 'exit', exitInfo?: { duration: number, fee: number }) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicle, type, exitInfo })
      });

      if (!response.ok) {
        throw new Error('Error al enviar a la impresora local.');
      }

      const result = await response.json();
      console.log('Ticket enviado correctamente:', result);
      return true;
    } catch (error) {
      console.error('Error de impresión nativa:', error);
      // Fallback: Si el servidor de impresión no está, usamos el navegador
      window.print();
      return false;
    }
  }

  async printCashReport(report: unknown) {
    try {
      const response = await fetch(this.cashReportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ report })
      });

      if (!response.ok) {
        throw new Error('Error al enviar a la impresora local.');
      }

      return true;
    } catch (error) {
      console.error('Error de impresión nativa:', error);
      window.print();
      return false;
    }
  }
}
