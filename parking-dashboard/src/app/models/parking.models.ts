export type VehicleType = 'auto' | 'camioneta' | 'camion';
export type PrepaidType = 'none' | '12night' | '24hours';

export interface ParkingRates {
  firstHour: number;
  secondHour: number;
  toleranceMinutes: number;
  prepaid12Night: number;
  prepaid24Hours: number;
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
    lastBilledDate?: Date;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  plate?: string;
  checkedInAt: Date;
  isSubscriber?: boolean;
  ticketNumber?: string;
  prepaidType?: PrepaidType;
  prepaidPaid?: number;
}