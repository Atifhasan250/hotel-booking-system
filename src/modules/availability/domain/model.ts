export type DateString = string; // YYYY-MM-DD

export interface InventoryDay {
  _id: string;
  roomTypeId: string;
  localDate: DateString;
  capacity: number;
  adjustment: number;
  stopSell: boolean;
  minStay?: number;
  maxStay?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type HoldStatus = "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED";

export interface InventoryHold {
  _id: string;
  bookingRef: string;
  roomTypeId: string;
  localDates: DateString[];
  quantity: number;
  status: HoldStatus;
  expiresAt: string; // ISO date-time
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDayInput {
  roomTypeId: string;
  localDate: DateString;
  capacity?: number;
  adjustment?: number;
  stopSell?: boolean;
  minStay?: number;
  maxStay?: number;
}
