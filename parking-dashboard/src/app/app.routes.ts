import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ParkingInComponent } from './parking-in/parking-in.component';
import { ParkingOutComponent } from './parking-out/parking-out.component';
import { RatesComponent } from './rates/rates.component';
import { SubscribersComponent } from './subscribers/subscribers.component';
import { CashRegisterComponent } from './cash-register/cash-register.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', component: DashboardComponent },
      { path: 'registro', component: ParkingInComponent },
      { path: 'salida', component: ParkingOutComponent },
      { path: 'tarifas', component: RatesComponent },
      { path: 'abonados', component: SubscribersComponent },
      { path: 'caja', component: CashRegisterComponent }
    ]
  }
];
