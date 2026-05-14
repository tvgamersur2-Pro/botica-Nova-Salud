/**
 * TypeScript types for Transaction management.
 * Requirements: DR-2, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8
 */

export type PaymentMethod = 'cash' | 'credit' | 'insurance';
export type TransactionStatus = 'pending' | 'completed' | 'voided';
export type RefundStatus = 'none' | 'partial' | 'full';

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface TransactionRecord {
  id: string;
  timestamp: Date;
  totalAmount: number;
  taxAmount: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName?: string;
  customerId: string | null;
  refundStatus: RefundStatus;
  status: TransactionStatus;
  createdAt: Date;
  items?: TransactionItem[];
}

export interface TransactionItemInput {
  productId: string;
  quantity: number;
}

export interface CreateTransactionInput {
  items: TransactionItemInput[];
  paymentMethod: PaymentMethod;
  customerId?: string;
  taxRate?: number; // default 0
}

export interface ListTransactionsOptions {
  cashierId?: string;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: TransactionRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number; };
}

export interface ReceiptData {
  transactionId: string;
  timestamp: Date;
  cashierName: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number; }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
}
