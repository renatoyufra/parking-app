import { AsyncPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-reloj',
  template: `{{ time$ | async | date:'HH:mm:ss' }}`,
  standalone: true,
  imports: [AsyncPipe, DatePipe]
})
export class RelojComponent {
  time$: Observable<Date> = interval(1000).pipe(
    map(() => new Date())
  );
}