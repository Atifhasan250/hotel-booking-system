export type DateString = string; // YYYY-MM-DD

export interface RatePlan {
  _id: string;
  roomTypeId: string;
  name: string;
  cancellationPolicy: string;
  mealPlan: string;
  occupancyRules: {
    adults: number;
    children: number;
  };
  basePrice: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface RateOverride {
  _id: string;
  ratePlanId: string;
  localDate: DateString;
  amount: number;
  minStay?: number;
  maxStay?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  _id: string;
  vendorId: string;
  propertyId?: string;
  name: string;
  bookingWindow: { start: DateString; end: DateString };
  stayWindow: { start: DateString; end: DateString };
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  stackable: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface PriceQuote {
  _id: string;
  bookingRef: string;
  nightlyLines: Array<{
    date: DateString;
    ratePlanId: string;
    baseRate: number;
    discount: number;
    finalRate: number;
  }>;
  occupants: { adults: number; children: number };
  appliedOfferId?: string;
  taxes: number;
  fees: number;
  total: number;
  currency: string;
  expiresAt: string;
  createdAt: string;
}
