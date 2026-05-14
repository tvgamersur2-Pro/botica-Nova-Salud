/**
 * TypeScript types for Transaction management in the frontend.
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

export interface Transaction {
  id: string;
  timestamp: string;
  totalAmount: number;
  taxAmount: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName?: string | null;
  customerId: string | null;
  refundStatus: RefundStatus;
  status: TransactionStatus;
  createdAt: string;
  items?: TransactionItem[];
}

export interface ReceiptData {
  id: string;
  timestamp: string;
  items: TransactionItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashier: string;
  status: TransactionStatus;
}

// ----------------------------------------------------------------
// API request payloads
// ----------------------------------------------------------------

export interface TransactionItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateTransactionPayload {
  items: TransactionItemPayload[];
  paymentMethod: PaymentMethod;
  taxAmount?: number;
  customerId?: string;
}

// ----------------------------------------------------------------
// API response shapes
// ----------------------------------------------------------------

export interface TransactionResponse {
  data: Transaction;
}

export interface PaginatedTransactionsResponse {
  data: Transaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReceiptResponse {
  data: ReceiptData;
}

// ----------------------------------------------------------------
// Filter / query options
// ----------------------------------------------------------------

export interface TransactionFilters {
  cashierId?: string;
  status?: TransactionStatus | '';
  paymentMethod?: PaymentMethod | '';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ----------------------------------------------------------------
// Cart item (frontend-only, before transaction is created)
// ----------------------------------------------------------------

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  maxQuantity: number; // available stock
}
