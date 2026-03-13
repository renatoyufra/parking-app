import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { Vehicle } from '../../models/parking.models';
// import QRCode from 'qrcode-svg';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket.component.html',
  styleUrls: ['./ticket.component.scss']
})
export class TicketComponent implements OnChanges {
  @Input({ required: true }) vehicle!: Vehicle;
  qrSvg: SafeHtml | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
   /*  if (changes['vehicle'] && this.vehicle) {
      this.generateQr();
    } */
  }

  /* generateQr() {
    const qr = new QRCode({
      content: this.vehicle.id,
      padding: 0,
      width: 120,
      height: 120,
      color: "#000000",
      background: "#ffffff",
      ecl: "M"
    });
    this.qrSvg = this.sanitizer.bypassSecurityTrustHtml(qr.svg());
  } */

  get formattedDate(): string {
    const d = this.vehicle.checkedInAt;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  }
}
