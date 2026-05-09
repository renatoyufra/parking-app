export type VehicleType = 'auto' | 'camioneta' | 'camion';

export interface ParkingRates {
  firstHour: number;
  secondHour: number;
  toleranceMinutes: number;
}

export type VehicleRates = Record<VehicleType, ParkingRates>;

export interface Subscriber {
  id: string;
  name: string;
  plate: string;
  type: VehicleType;
  startDate: Date;
  endDate: Date;
  monthlyFee: number;
  balanceDue: number;
  active: boolean;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  plate?: string;
  checkedInAt: Date;
  isSubscriber?: boolean;
  ticketNumber?: string;
}