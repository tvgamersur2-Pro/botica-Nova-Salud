/**
 * API client for Transaction management.
 *
 * Uses the shared axios instance from api.ts which handles
 * authentication tokens and token refresh automatically.
 *
 * Requirements: FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8
 */

import apiClient from './api';
import type {
  Transaction,
  ReceiptData,
  CreateTransactionPayload,
  PaginatedTransactionsResponse,
  TransactionResponse,
  ReceiptResponse,
  TransactionFilters,
} from '../types/transaction';

export const transactionsApi = {
  /**
   * Create a new transaction.
   * Requirements: FR-2.1, FR-2.3, FR-2.4, FR-2.5
   */
  create: (payload: CreateTransactionPayload): Promise<Transaction> =>
    apiClient
      .post<TransactionResponse>('/transactions', payload)
      .then((r) => r.data.data),

  /**
   * List transactions with optional filters and pagination.
   * Requirements: FR-2.2
   */
  list: (filters: TransactionFilters = {}): Promise<PaginatedTransactionsResponse> => {
    const params: Record<string, string> = {};

    if (filters.cashierId)                          params.cashierId     = filters.cashierId;
    if (filters.status)                             params.status        = filters.status;
    if (filters.paymentMethod)                      params.paymentMethod = filters.paymentMethod;
    if (filters.dateFrom)                           params.dateFrom      = filters.dateFrom;
    if (filters.dateTo)                             params.dateTo        = filters.dateTo;
    if (filters.page !== undefined)                 params.page          = String(filters.page);
    if (filters.limit !== undefined)                params.limit         = String(filters.limit);

    return apiClient
      .get<PaginatedTransactionsResponse>('/transactions', { params })
      .then((r) => r.data);
  },

  /**
   * Get a single transaction by ID, including items.
   * Requirements: FR-2.2
   */
  getById: (id: string): Promise<Transaction> =>
    apiClient
      .get<TransactionResponse>(`/transactions/${id}`)
      .then((r) => r.data.data),

  /**
   * Void a transaction and restore stock.
   * Requirements: FR-2.7
   */
  void: (id: string): Promise<Transaction> =>
    apiClient
      .put<TransactionResponse>(`/transactions/${id}/void`, {})
      .then((r) => r.data.data),

  /**
   * Refund a transaction and restore stock.
   * Requirements: FR-2.7
   */
  refund: (id: string): Promise<Transaction> =>
    apiClient
      .put<TransactionResponse>(`/transactions/${id}/refund`, {})
      .then((r) => r.data.data),

  /**
   * Get receipt data for a transaction.
   * Requirements: FR-2.6
   */
  getReceipt: (id: string): Promise<ReceiptData> =>
    apiClient
      .get<ReceiptResponse>(`/transactions/${id}/receipt`)
      .then((r) => r.data.data),
};

export default transactionsApi;
