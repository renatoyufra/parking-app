import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExitFormComponent } from './exit-form/exit-form.component';

@Component({
  selector: 'app-parking-out',
  standalone: true,
  imports: [CommonModule, ExitFormComponent],
  templateUrl: './parking-out.component.html',
  styleUrls: ['./parking-out.component.scss']
})
export class ParkingOutComponent { }
