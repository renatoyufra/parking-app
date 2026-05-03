import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationPipe implements PipeTransform {
  transform(durationMinutes: number | null | undefined): string {
    if (durationMinutes == null || !Number.isFinite(durationMinutes) || durationMinutes < 0) {
      return '0 min';
    }
    
    if (durationMinutes < 60) {
      return `${Math.round(durationMinutes)} min`;
    }
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.round(durationMinutes % 60);
    
    if (minutes === 0) {
      return `${hours} h`;
    }
    
    return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  }
}
