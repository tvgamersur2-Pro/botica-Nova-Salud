/**
 * ReportsDashboard Component
 *
 * Provides sales and inventory report generation with:
 *  - Date range selector for sales reports
 *  - Summary statistics cards
 *  - Top selling products table
 *  - Payment method breakdown
 *  - Inventory status with low stock and expiring highlights
 *  - CSV export buttons
 *
 * Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6, FR-5.1, FR-5.3
 */

import React, { useState } from 'react';
import { reportsApi } from '../../services/reportApi';
import type {
  SalesReport,
  InventoryReport,
  SalesReportFilters,
} from '../../types/report';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getFirstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  variant?: 'blue' | 'green' | 'yellow' | 'red';
}

function StatCard({ label, value, variant = 'blue' }: StatCardProps) {
  const classes: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 ring-blue-200',
    green:  'bg-green-50 text-green-700 ring-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    red:    'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    <div className={`rounded-lg p-4 ring-1 ${classes[variant]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-1">{label}</p>
    </div>
  );
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface ReportsDashboardProps {
  userRole: 'admin' | 'pharmacist' | 'cashier';
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ReportsDashboard({ userRole: _userRole }: ReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory'>('sales');

  // Sales report state
  const [salesFilters, setSalesFilters] = useState<SalesReportFilters>({
    from: getFirstDayOfMonth(),
    to:   getTodayString(),
  });
  const [salesReport, setSalesReport]     = useState<SalesReport | null>(null);
  const [salesLoading, setSalesLoading]   = useState(false);
  const [salesError, setSalesError]       = useState<string | null>(null);
  const [exportingCSV, setExportingCSV]   = useState(false);

  // Inventory report state
  const [inventoryReport, setInventoryReport]   = useState<InventoryReport | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError]     = useState<string | null>(null);
  const [exportingInvCSV, setExportingInvCSV]   = useState(false);

  // ----------------------------------------------------------------
  // Sales report
  // ----------------------------------------------------------------

  const handleGenerateSales = async () => {
    if (!salesFilters.from || !salesFilters.to) {
      setSalesError('Selecciona un rango de fechas.');
      return;
    }
    setSalesLoading(true);
    setSalesError(null);
    try {
      const report = await reportsApi.getSalesReport(salesFilters);
      setSalesReport(report);
    } catch (err: unknown) {
      setSalesError(err instanceof Error ? err.message : 'Error al generar el reporte.');
    } finally {
      setSalesLoading(false);
    }
  };

  const handleExportSalesCSV = async () => {
    if (!salesFilters.from || !salesFilters.to) return;
    setExportingCSV(true);
    try {
      const blob = await reportsApi.exportSalesCSV(salesFilters);
      downloadBlob(blob, `ventas_${salesFilters.from}_${salesFilters.to}.csv`);
    } catch (err: unknown) {
      setSalesError(err instanceof Error ? err.message : 'Error al exportar.');
    } finally {
      setExportingCSV(false);
    }
  };

  // ----------------------------------------------------------------
  // Inventory report
  // ----------------------------------------------------------------

  const handleGenerateInventory = async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const report = await reportsApi.getInventoryReport();
      setInventoryReport(report);
    } catch (err: unknown) {
      setInventoryError(err instanceof Error ? err.message : 'Error al generar el reporte.');
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleExportInventoryCSV = async () => {
    setExportingInvCSV(true);
    try {
      const blob = await reportsApi.exportInventoryCSV();
      downloadBlob(blob, `inventario_${getTodayString()}.csv`);
    } catch (err: unknown) {
      setInventoryError(err instanceof Error ? err.message : 'Error al exportar.');
    } finally {
      setExportingInvCSV(false);
    }
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Reportes</h2>
        <p className="text-sm text-gray-500">Genera y exporta reportes de ventas e inventario</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Pestañas de reportes">
          {(['sales', 'inventory'] as const).map((tab) => {
            const labels = { sales: 'Ventas', inventory: 'Inventario' };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4 rounded-lg bg-gray-50 p-4">
            <div>
              <label htmlFor="sales-from" className="block text-xs font-medium text-gray-600 mb-1">
                Desde
              </label>
              <input
                id="sales-from"
                type="date"
                value={salesFilters.from}
                onChange={(e) => setSalesFilters((p) => ({ ...p, from: e.target.value }))}
                className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="sales-to" className="block text-xs font-medium text-gray-600 mb-1">
                Hasta
              </label>
              <input
                id="sales-to"
                type="date"
                value={salesFilters.to}
                onChange={(e) => setSalesFilters((p) => ({ ...p, to: e.target.value }))}
                className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateSales()}
              disabled={salesLoading}
              aria-busy={salesLoading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {salesLoading ? 'Generando…' : 'Generar Reporte'}
            </button>
            {salesReport && (
              <button
                type="button"
                onClick={() => void handleExportSalesCSV()}
                disabled={exportingCSV}
                aria-label="Exportar reporte de ventas como CSV"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {exportingCSV ? 'Exportando…' : 'Exportar CSV'}
              </button>
            )}
          </div>

          {salesError && (
            <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              {salesError}
            </div>
          )}

          {salesReport && (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="region" aria-label="Resumen de ventas">
                <StatCard label="Ventas totales"    value={formatCurrency(salesReport.totalSales)}  variant="green" />
                <StatCard label="Transacciones"     value={String(salesReport.transactionCount)}    variant="blue"  />
                <StatCard
                  label="Promedio por venta"
                  value={salesReport.transactionCount > 0
                    ? formatCurrency(salesReport.totalSales / salesReport.transactionCount)
                    : formatCurrency(0)}
                  variant="blue"
                />
              </div>

              {/* Payment method breakdown */}
              {salesReport.paymentMethodBreakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Desglose por método de pago</h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200" aria-label="Desglose por método de pago">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Método</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Transacciones</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {salesReport.paymentMethodBreakdown.map((row) => (
                          <tr key={row.method}>
                            <td className="px-4 py-3 text-sm capitalize text-gray-900">
                              {row.method === 'cash' ? 'Efectivo' : row.method === 'credit' ? 'Tarjeta' : 'Seguro'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{row.count}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top selling products */}
              {salesReport.topSellingProducts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Productos más vendidos</h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200" aria-label="Productos más vendidos">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Unidades</th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Ingresos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {salesReport.topSellingProducts.map((product, idx) => (
                          <tr key={product.productId}>
                            <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.productName}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{product.totalQuantity}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(product.totalRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Generado el {formatDate(salesReport.generatedAt)} · Período: {formatDate(salesReport.dateRange.from)} – {formatDate(salesReport.dateRange.to)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleGenerateInventory()}
              disabled={inventoryLoading}
              aria-busy={inventoryLoading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {inventoryLoading ? 'Generando…' : 'Generar Reporte'}
            </button>
            {inventoryReport && (
              <button
                type="button"
                onClick={() => void handleExportInventoryCSV()}
                disabled={exportingInvCSV}
                aria-label="Exportar reporte de inventario como CSV"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {exportingInvCSV ? 'Exportando…' : 'Exportar CSV'}
              </button>
            )}
          </div>

          {inventoryError && (
            <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              {inventoryError}
            </div>
          )}

          {inventoryReport && (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="region" aria-label="Resumen de inventario">
                <StatCard label="Total productos"  value={String(inventoryReport.totalProducts)}     variant="blue"   />
                <StatCard label="Stock bajo"       value={String(inventoryReport.lowStockCount)}     variant="yellow" />
                <StatCard label="Por vencer"       value={String(inventoryReport.expiringSoonCount)} variant="yellow" />
                <StatCard label="Vencidos"         value={String(inventoryReport.expiredCount)}      variant="red"    />
              </div>

              {/* Inventory table */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200" aria-label="Reporte de inventario">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Categoría</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Stock</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Umbral</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Vencimiento</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {inventoryReport.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                          No hay productos en el inventario.
                        </td>
                      </tr>
                    ) : (
                      inventoryReport.items.map((item) => (
                        <tr
                          key={item.id}
                          className={
                            item.isExpired
                              ? 'bg-red-50'
                              : item.isLowStock || item.isExpiringSoon
                              ? 'bg-yellow-50'
                              : ''
                          }
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            {item.dosage && <p className="text-xs text-gray-500">{item.dosage}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm capitalize text-gray-700">{item.category}</td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{item.quantityInStock}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-500">{item.minStockThreshold}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.expirationDate)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {item.isExpired && (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                  Vencido
                                </span>
                              )}
                              {!item.isExpired && item.isExpiringSoon && (
                                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                                  Por vencer
                                </span>
                              )}
                              {item.isLowStock && (
                                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                  Stock bajo
                                </span>
                              )}
                              {!item.isExpired && !item.isExpiringSoon && !item.isLowStock && (
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  OK
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400">
                Generado el {formatDate(inventoryReport.generatedAt)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
