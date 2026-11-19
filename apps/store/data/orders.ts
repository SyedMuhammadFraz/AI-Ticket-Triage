import type { OrderStatus, PaymentMethod } from "@/lib/domain";

/**
 * Order history for the demo. Dates are relative to the moment you seed, so the
 * story always looks current. Several orders are set up to produce realistic
 * support tickets later (a delayed furniture order before an office opening, a
 * partial toner delivery, an item outside the return window, …).
 */
export type SeedOrder = {
  company: string;
  buyer: string;
  status: OrderStatus;
  placedDaysAgo: number;
  paymentMethod: PaymentMethod;
  poNumber?: string;
  items: Array<{ sku: string; quantity: number; delivered?: number }>;
  carrier?: string;
  trackingNumber?: string;
  /** Days from now (negative = in the past). */
  etaDays?: number;
  /** Optional story beat added to the timeline. */
  note?: string;
};

export const SEED_ORDERS: SeedOrder[] = [
  // Meridian Health Partners (Enterprise)
  {
    company: "meridian-health", buyer: "grace.liu@meridianhealth.example", status: "delayed", placedDaysAgo: 9,
    paymentMethod: "invoice", poNumber: "MHP-PO-88213", carrier: "Fernway Freight", trackingNumber: "FWF-3318204",
    etaDays: 4, note: "Carrier capacity issue at the regional hub. Delivery rescheduled.",
    items: [{ sku: "FUR-5001", quantity: 60 }, { sku: "FUR-5002", quantity: 30 }, { sku: "FUR-5003", quantity: 30 }],
  },
  {
    company: "meridian-health", buyer: "daniel.okafor@meridianhealth.example", status: "partially_delivered", placedDaysAgo: 6,
    paymentMethod: "invoice", poNumber: "MHP-PO-88140", carrier: "SwiftLine Parcel", trackingNumber: "SL7741029384",
    etaDays: 2, note: "2 of 3 packages delivered. Remaining package in transit.",
    items: [{ sku: "INK-3002", quantity: 3, delivered: 2 }, { sku: "INK-3020", quantity: 2, delivered: 2 }],
  },
  {
    company: "meridian-health", buyer: "daniel.okafor@meridianhealth.example", status: "delivered", placedDaysAgo: 21,
    paymentMethod: "invoice", poNumber: "MHP-PO-87902", carrier: "SwiftLine Parcel", trackingNumber: "SL7740488211",
    items: [{ sku: "PAP-1001", quantity: 40 }, { sku: "WRT-2002", quantity: 20 }, { sku: "PAP-1020", quantity: 15 }],
  },
  {
    company: "meridian-health", buyer: "grace.liu@meridianhealth.example", status: "processing", placedDaysAgo: 0,
    paymentMethod: "invoice", poNumber: "MHP-PO-88301",
    items: [{ sku: "BRK-7001", quantity: 12 }, { sku: "BRK-7002", quantity: 4 }, { sku: "BRK-7003", quantity: 10 }],
  },

  // Atlas Engineering Group (Enterprise)
  {
    company: "atlas-engineering", buyer: "aisha.rahman@atlaseng.example", status: "shipped", placedDaysAgo: 3,
    paymentMethod: "invoice", poNumber: "ATL-24-1187", carrier: "SwiftLine Parcel", trackingNumber: "SL7741552090", etaDays: 1,
    items: [{ sku: "TEC-6002", quantity: 25 }, { sku: "TEC-6003", quantity: 25 }, { sku: "TEC-6005", quantity: 10 }],
  },
  {
    company: "atlas-engineering", buyer: "tomas.herrera@atlaseng.example", status: "delivered", placedDaysAgo: 7,
    paymentMethod: "invoice", poNumber: "ATL-24-1162", carrier: "Fernway Freight", trackingNumber: "FWF-3317752",
    items: [{ sku: "FUR-5003", quantity: 12 }],
  },
  {
    company: "atlas-engineering", buyer: "tomas.herrera@atlaseng.example", status: "cancelled", placedDaysAgo: 14,
    paymentMethod: "invoice", poNumber: "ATL-24-1120", note: "Cancelled at the customer's request before dispatch.",
    items: [{ sku: "DSK-4020", quantity: 5 }],
  },

  // Pinecrest Accounting LLP (Business)
  {
    company: "pinecrest-accounting", buyer: "maya.chen@pinecrestcpa.example", status: "delivered", placedDaysAgo: 38,
    paymentMethod: "invoice", poNumber: "PC-4471", carrier: "SwiftLine Parcel", trackingNumber: "SL7738820145",
    items: [{ sku: "INK-3001", quantity: 4 }],
  },
  {
    company: "pinecrest-accounting", buyer: "maya.chen@pinecrestcpa.example", status: "delivered", placedDaysAgo: 8,
    paymentMethod: "invoice", carrier: "SwiftLine Parcel", trackingNumber: "SL7741007733",
    items: [{ sku: "PAP-1001", quantity: 6 }, { sku: "WRT-2001", quantity: 5 }, { sku: "PAP-1020", quantity: 2 }],
  },
  {
    company: "pinecrest-accounting", buyer: "maya.chen@pinecrestcpa.example", status: "shipped", placedDaysAgo: 2,
    paymentMethod: "invoice", poNumber: "PC-4519", carrier: "Fernway Freight", trackingNumber: "FWF-3318990", etaDays: 3,
    items: [{ sku: "FUR-5001", quantity: 2 }],
  },

  // Harbor Logistics Co. (Business)
  {
    company: "harbor-logistics", buyer: "sofia.rossi@harborlogistics.example", status: "delivered", placedDaysAgo: 4,
    paymentMethod: "invoice", poNumber: "HL-0932", carrier: "SwiftLine Parcel", trackingNumber: "SL7741320077",
    items: [{ sku: "BRK-7003", quantity: 8 }, { sku: "BRK-7004", quantity: 6 }, { sku: "BRK-7005", quantity: 4 }],
  },
  {
    company: "harbor-logistics", buyer: "sofia.rossi@harborlogistics.example", status: "processing", placedDaysAgo: 1,
    paymentMethod: "invoice", poNumber: "HL-0951",
    items: [{ sku: "TEC-6004", quantity: 10 }, { sku: "TEC-6001", quantity: 10 }],
  },
  {
    company: "harbor-logistics", buyer: "sofia.rossi@harborlogistics.example", status: "returned", placedDaysAgo: 26,
    paymentMethod: "invoice", poNumber: "HL-0874", carrier: "Fernway Freight", trackingNumber: "FWF-3315521",
    note: "Return received and inspected. Credit note issued.",
    items: [{ sku: "FUR-5004", quantity: 3 }],
  },

  // Brightside Dental Clinic (Starter)
  {
    company: "brightside-dental", buyer: "priya.nair@brightsidedental.example", status: "delivered", placedDaysAgo: 5,
    paymentMethod: "card", carrier: "SwiftLine Parcel", trackingNumber: "SL7741210456",
    items: [{ sku: "BRK-7001", quantity: 2 }, { sku: "BRK-7002", quantity: 1 }, { sku: "BRK-7004", quantity: 2 }],
  },
  {
    company: "brightside-dental", buyer: "priya.nair@brightsidedental.example", status: "shipped", placedDaysAgo: 2,
    paymentMethod: "card", carrier: "Fernway Freight", trackingNumber: "FWF-3318871", etaDays: 2,
    items: [{ sku: "FUR-5005", quantity: 3 }],
  },

  // Lin & Moreau Architects (Starter)
  {
    company: "lin-moreau-architects", buyer: "lukas.becker@linmoreau.example", status: "delivered", placedDaysAgo: 12,
    paymentMethod: "card", carrier: "SwiftLine Parcel", trackingNumber: "SL7740912338",
    items: [{ sku: "PAP-1002", quantity: 3 }, { sku: "WRT-2010", quantity: 4 }],
  },
  {
    company: "lin-moreau-architects", buyer: "lukas.becker@linmoreau.example", status: "processing", placedDaysAgo: 0,
    paymentMethod: "card",
    items: [{ sku: "FUR-5002", quantity: 1 }, { sku: "TEC-6003", quantity: 2 }],
  },
];
