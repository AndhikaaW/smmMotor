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
  /** HPP per unit saat transaksi (snapshot harga beli produk). Jasa = 0. */
  cost?: number;
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

export type ExpenseCategory =
  | "salary"
  | "rent"
  | "utilities"
  | "transport"
  | "supplies"
  | "maintenance"
  | "other";

export interface Expense {
  id: string;
  /** Tanggal WIB `YYYY-MM-DD` (bukan timestamp agar aman dari geser zona waktu). */
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
