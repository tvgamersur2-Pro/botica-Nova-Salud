/**
 * SalesCart Component
 *
 * Provides a point-of-sale cart interface for processing transactions:
 *  - Real-time product search
 *  - Add/remove items with quantity control
 *  - Subtotal, tax, and total calculation
 *  - Payment method selection (cash, credit, insurance)
 *  - Stock validation with error feedback
 *  - Transaction submission
 *
 * Requirements: FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.8
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { productsApi } from '../../services/productApi';
import { transactionsApi } from '../../services/transactionApi';
import type { Product } from '../../types/product';
import type { CartItem, PaymentMethod } from '../../types/transaction';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const TAX_RATE = 0.16; // 16% IVA

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

function isExpired(expirationDate: string): boolean {
  return new Date(expirationDate) < new Date();
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface SalesCartProps {
  /** Called with the new transaction ID after a successful sale */
  onTransactionComplete: (transactionId: string) => void;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function SalesCart({ onTransactionComplete }: SalesCartProps) {
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Product search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Transaction state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----------------------------------------------------------------
  // Product search with debounce
  // ----------------------------------------------------------------

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const result = await productsApi.list({ search: q, limit: 10 });
      setSearchResults(result.data.filter((p) => !isExpired(p.expirationDate)));
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void searchProducts(searchQuery);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, searchProducts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ----------------------------------------------------------------
  // Cart operations
  // ----------------------------------------------------------------

  const addToCart = (product: Product) => {
    setError(null);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= existing.maxQuantity) {
          setError(`Stock insuficiente para "${product.name}". Disponible: ${existing.maxQuantity}`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      if (product.quantityInStock === 0) {
        setError(`"${product.name}" no tiene stock disponible.`);
        return prev;
      }
      return [
        ...prev,
        {
          productId:   product.id,
          productName: product.name,
          quantity:    1,
          unitPrice:   product.unitPrice,
          maxQuantity: product.quantityInStock,
        },
      ];
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
    setError(null);
  };

  const updateQuantity = (productId: string, newQty: number) => {
    setError(null);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (newQty <= 0) return item; // handled by remove button
        if (newQty > item.maxQuantity) {
          setError(`Stock insuficiente para "${item.productName}". Disponible: ${item.maxQuantity}`);
          return item;
        }
        return { ...item, quantity: newQty };
      }),
    );
  };

  // ----------------------------------------------------------------
  // Totals
  // ----------------------------------------------------------------

  const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const total = parseFloat((subtotal + taxAmount).toFixed(2));

  // ----------------------------------------------------------------
  // Submit transaction
  // ----------------------------------------------------------------

  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const transaction = await transactionsApi.create({
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity:  item.quantity,
          unitPrice: item.unitPrice,
        })),
        paymentMethod,
        taxAmount,
      });
      setCartItems([]);
      setPaymentMethod('cash');
      setSuccessMessage(`Venta procesada exitosamente. ID: ${transaction.id}`);
      onTransactionComplete(transaction.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al procesar la venta. Intenta de nuevo.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Nueva Venta</h2>
        <p className="text-sm text-gray-500">Busca productos y agrégalos al carrito</p>
      </div>

      {/* Product search */}
      <div ref={searchRef} className="relative">
        <label htmlFor="product-search" className="block text-sm font-medium text-gray-700 mb-1">
          Buscar producto
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {searchLoading ? (
              <svg
                className="h-4 w-4 animate-spin text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <input
            id="product-search"
            type="search"
            placeholder="Nombre, dosificación o ID del producto…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            autoComplete="off"
            aria-label="Buscar producto para agregar al carrito"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          />
        </div>

        {/* Search results dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <ul
            role="listbox"
            aria-label="Resultados de búsqueda"
            className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto"
          >
            {searchResults.map((product) => (
              <li
                key={product.id}
                role="option"
                aria-selected={false}
                onClick={() => addToCart(product)}
                onKeyDown={(e) => e.key === 'Enter' && addToCart(product)}
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {[product.dosage, product.form].filter(Boolean).join(' · ')} ·{' '}
                    Stock: {product.quantityInStock}
                  </p>
                </div>
                <span className="ml-4 text-sm font-semibold text-indigo-600">
                  {formatCurrency(product.unitPrice)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {showDropdown && !searchLoading && searchQuery.trim() && searchResults.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md bg-white px-4 py-3 shadow-lg ring-1 ring-black ring-opacity-5 text-sm text-gray-500">
            No se encontraron productos.
          </div>
        )}
      </div>

      {/* Error / success messages */}
      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </div>
      )}
      {successMessage && (
        <div
          role="status"
          className="rounded-md bg-green-50 p-3 text-sm text-green-700 ring-1 ring-green-200"
        >
          {successMessage}
        </div>
      )}

      {/* Cart items */}
      {cartItems.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Producto
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                  Cantidad
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                  Precio Unit.
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                  Total
                </th>
                <th scope="col" className="relative px-4 py-3">
                  <span className="sr-only">Eliminar</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {cartItems.map((item) => (
                <tr key={item.productId}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-400">Stock disponible: {item.maxQuantity}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        aria-label={`Reducir cantidad de ${item.productName}`}
                        onClick={() =>
                          item.quantity > 1
                            ? updateQuantity(item.productId, item.quantity - 1)
                            : removeFromCart(item.productId)
                        }
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.maxQuantity}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value, 10))}
                        aria-label={`Cantidad de ${item.productName}`}
                        className="w-14 rounded border border-gray-300 py-0.5 text-center text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        aria-label={`Aumentar cantidad de ${item.productName}`}
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Eliminar ${item.productName} del carrito`}
                      onClick={() => removeFromCart(item.productId)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          El carrito está vacío. Busca un producto para comenzar.
        </div>
      )}

      {/* Totals + payment */}
      {cartItems.length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4 space-y-3">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA (16%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Método de pago</legend>
              <div className="flex gap-3">
                {(['cash', 'credit', 'insurance'] as PaymentMethod[]).map((method) => {
                  const labels: Record<PaymentMethod, string> = {
                    cash:      'Efectivo',
                    credit:    'Tarjeta',
                    insurance: 'Seguro',
                  };
                  return (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        paymentMethod === method
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="sr-only"
                        aria-label={`Pagar con ${labels[method]}`}
                      />
                      {labels[method]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Submit button */}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || cartItems.length === 0}
            aria-busy={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Procesando…
              </span>
            ) : (
              `Procesar Venta · ${formatCurrency(total)}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
