/**
 * TransactionHistory Component
 *
 * Displays a paginated, filterable list of transactions with:
 *  - Filters by date range, status, and payment method
 *  - Void and Refund actions with confirmation dialogs
 *  - View Receipt button
 *  - Role-based action visibility
 *
 * Requirements: FR-2.2, FR-2.6, FR-2.7, FR-5.7
 */

import React, { useCallback, useEffect, useState } from 'react';
import { transactionsApi } from '../../services/transactionApi';
import type {
  Transaction,
  TransactionFilters,
  TransactionStatus,
  PaymentMethod,
  ReceiptData,
} from '../../types/transaction';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-MX', {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ----------------------------------------------------------------
// Badge sub-component
// ----------------------------------------------------------------

interface BadgeProps {
  label: string;
  variant: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange';
}

function Badge({ label, variant }: BadgeProps) {
  const classes: Record<BadgeProps['variant'], string> = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue:   'bg-blue-100 text-blue-800',
    gray:   'bg-gray-100 text-gray-700',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant]}`}>
      {label}
    </span>
  );
}

function statusBadge(status: TransactionStatus) {
  const map: Record<TransactionStatus, { label: string; variant: BadgeProps['variant'] }> = {
    completed: { label: 'Completada', variant: 'green'  },
    pending:   { label: 'Pendiente',  variant: 'yellow' },
    voided:    { label: 'Anulada',    variant: 'red'    },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <Badge label={label} variant={variant} />;
}

function paymentBadge(method: PaymentMethod) {
  const map: Record<PaymentMethod, { label: string; variant: BadgeProps['variant'] }> = {
    cash:      { label: 'Efectivo', variant: 'green' },
    credit:    { label: 'Tarjeta',  variant: 'blue'  },
    insurance: { label: 'Seguro',   variant: 'orange'},
  };
  const { label, variant } = map[method] ?? { label: method, variant: 'gray' };
  return <Badge label={label} variant={variant} />;
}

// ----------------------------------------------------------------
// Receipt Modal
// ----------------------------------------------------------------

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 id="receipt-title" className="text-lg font-semibold text-gray-900">
            Recibo de Venta
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar recibo"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4 text-sm">
          <div className="text-center text-gray-500">
            <p className="font-semibold text-gray-900">Nova Salud</p>
            <p>ID: {receipt.id}</p>
            <p>{formatDateTime(receipt.timestamp)}</p>
            <p>Cajero: {receipt.cashier}</p>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left pb-1">Producto</th>
                  <th className="text-center pb-1">Cant.</th>
                  <th className="text-right pb-1">Precio</th>
                  <th className="text-right pb-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receipt.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1 text-gray-800">{item.productName}</td>
                    <td className="py-1 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-1 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-1 text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 pt-3 space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA</span>
              <span>{formatCurrency(receipt.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 text-base">
              <span>Total</span>
              <span>{formatCurrency(receipt.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs pt-1">
              <span>Método de pago</span>
              <span className="capitalize">{receipt.paymentMethod}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface TransactionHistoryProps {
  userRole: 'admin' | 'pharmacist' | 'cashier';
  /** Refresh trigger – increment to force a reload */
  refreshKey?: number;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function TransactionHistory({ userRole, refreshKey = 0 }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal]               = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [actionError, setActionError]   = useState<string | null>(null);

  // Receipt modal
  const [receipt, setReceipt]           = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<TransactionFilters>({
    status:        '',
    paymentMethod: '',
    dateFrom:      '',
    dateTo:        '',
    page:          1,
    limit:         20,
  });

  const canVoidRefund = userRole === 'admin' || userRole === 'cashier';

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters: TransactionFilters = {
        page:  filters.page,
        limit: filters.limit,
      };
      if (filters.status)        activeFilters.status        = filters.status;
      if (filters.paymentMethod) activeFilters.paymentMethod = filters.paymentMethod;
      if (filters.dateFrom)      activeFilters.dateFrom      = filters.dateFrom;
      if (filters.dateTo)        activeFilters.dateTo        = filters.dateTo;

      const result = await transactionsApi.list(activeFilters);
      setTransactions(result.data);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar transacciones.');
    } finally {
      setLoading(false);
    }
  }, [filters, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  // ----------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------

  const handleVoid = async (tx: Transaction) => {
    if (!window.confirm(`¿Anular la transacción ${tx.id.slice(0, 8)}…? Esta acción restaurará el stock.`)) return;
    setActionError(null);
    try {
      await transactionsApi.void(tx.id);
      void fetchTransactions();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al anular la transacción.');
    }
  };

  const handleRefund = async (tx: Transaction) => {
    if (!window.confirm(`¿Reembolsar la transacción ${tx.id.slice(0, 8)}…? Se restaurará el stock.`)) return;
    setActionError(null);
    try {
      await transactionsApi.refund(tx.id);
      void fetchTransactions();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al reembolsar la transacción.');
    }
  };

  const handleViewReceipt = async (txId: string) => {
    setReceiptLoading(txId);
    try {
      const data = await transactionsApi.getReceipt(txId);
      setReceipt(data);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al obtener el recibo.');
    } finally {
      setReceiptLoading(null);
    }
  };

  // ----------------------------------------------------------------
  // Filter helpers
  // ----------------------------------------------------------------

  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Historial de Transacciones</h2>
        <p className="text-sm text-gray-500">{total} transacción{total !== 1 ? 'es' : ''} en total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-gray-50 p-4">
        {/* Date from */}
        <div>
          <label htmlFor="date-from" className="block text-xs font-medium text-gray-600 mb-1">
            Desde
          </label>
          <input
            id="date-from"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          />
        </div>

        {/* Date to */}
        <div>
          <label htmlFor="date-to" className="block text-xs font-medium text-gray-600 mb-1">
            Hasta
          </label>
          <input
            id="date-to"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          />
        </div>

        {/* Status filter */}
        <div>
          <label htmlFor="status-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Estado
          </label>
          <select
            id="status-filter"
            value={filters.status ?? ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="completed">Completada</option>
            <option value="pending">Pendiente</option>
            <option value="voided">Anulada</option>
          </select>
        </div>

        {/* Payment method filter */}
        <div>
          <label htmlFor="payment-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Método de pago
          </label>
          <select
            id="payment-filter"
            value={filters.paymentMethod ?? ''}
            onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          >
            <option value="">Todos los métodos</option>
            <option value="cash">Efectivo</option>
            <option value="credit">Tarjeta</option>
            <option value="insurance">Seguro</option>
          </select>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {actionError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8" aria-label="Cargando transacciones">
          <svg className="h-8 w-8 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">ID</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Cajero</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Pago</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Total</th>
                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    No se encontraron transacciones.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {tx.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {formatDateTime(tx.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {tx.cashierName ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {statusBadge(tx.status)}
                        {tx.refundStatus !== 'none' && (
                          <Badge
                            label={tx.refundStatus === 'full' ? 'Reembolsado' : 'Reembolso parcial'}
                            variant="orange"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {paymentBadge(tx.paymentMethod)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View receipt */}
                        <button
                          type="button"
                          onClick={() => void handleViewReceipt(tx.id)}
                          disabled={receiptLoading === tx.id}
                          aria-label={`Ver recibo de transacción ${tx.id.slice(0, 8)}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                        >
                          {receiptLoading === tx.id ? 'Cargando…' : 'Recibo'}
                        </button>

                        {/* Void */}
                        {canVoidRefund && tx.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => void handleVoid(tx)}
                            aria-label={`Anular transacción ${tx.id.slice(0, 8)}`}
                            className="text-xs font-medium text-red-600 hover:text-red-500"
                          >
                            Anular
                          </button>
                        )}

                        {/* Refund */}
                        {canVoidRefund && tx.status !== 'voided' && tx.refundStatus !== 'full' && (
                          <button
                            type="button"
                            onClick={() => void handleRefund(tx)}
                            aria-label={`Reembolsar transacción ${tx.id.slice(0, 8)}`}
                            className="text-xs font-medium text-yellow-600 hover:text-yellow-500"
                          >
                            Reembolsar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700">
            Página <span className="font-medium">{filters.page}</span> de{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => handlePageChange((filters.page ?? 1) - 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => handlePageChange((filters.page ?? 1) + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
