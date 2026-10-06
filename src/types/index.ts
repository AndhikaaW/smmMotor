import type { Timestamp } from "firebase/firestore";

export type UserRole = "superadmin" | "admin";

export interface AppUser {
  uid: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
}

export type PaymentMethod = "cash" | "qris" | "transfer" | "debit" | "other";

export interface GeneralSettings {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  receiptHeader: string;
  receiptFooter: string;
  paperSize: "58" | "80";
  paymentMethods: PaymentMethod[];
}
export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  categoryId: string;
  categoryName: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minimumStock: number;
  unit: string;
  isActive: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  description: string;
  isActive: boolean;
}

export type CartItemType = "product" | "service";


export interface CartItem {
  type: CartItemType;
  productId?: string;
  serviceId?: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export type TransactionStatus = "completed" | "deleted";

export interface Transaction {
  id: string;
  transactionNumber: string;
  transactionDate: Timestamp;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  payment: number;
  change: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

export type StockMovementType = "in" | "out" | "adjustment" | "return";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceType: string;
  referenceId: string;
  note: string;
  userId: string;
  userName: string;
}
