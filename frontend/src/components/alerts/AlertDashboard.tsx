/**
 * AlertDashboard Component
 *
 * Displays active and resolved alerts with:
 *  - Statistics summary (total active, by type)
 *  - Filterable list by type and status
 *  - Resolve action with notes field
 *  - Role-based action visibility
 *
 * Requirements: FR-3.3, FR-3.4, FR-3.5, FR-3.6, FR-5.7
 */

import React, { useCallback, useEffect, useState } from 'react';
import { alertsApi } from '../../services/alertApi';
import type {
  Alert,
  AlertFilters,
  AlertStats,
  AlertType,
} from '../../types/alert';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

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

function alertTypeBadge(type: AlertType) {
  const map: Record<AlertType, { label: string; variant: BadgeProps['variant'] }> = {
    low_stock:     { label: 'Stock Bajo',       variant: 'yellow' },
    expiring_soon: { label: 'Por Vencer',        variant: 'orange' },
    expired:       { label: 'Vencido',           variant: 'red'    },
  };
  const { label, variant } = map[type] ?? { label: type, variant: 'gray' };
  return <Badge label={label} variant={variant} />;
}

// ----------------------------------------------------------------
// Resolve Modal
// ----------------------------------------------------------------

interface ResolveModalProps {
  alert: Alert;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function ResolveModal({ alert, onConfirm, onCancel, loading }: ResolveModalProps) {
  const [notes, setNotes] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 id="resolve-title" className="text-lg font-semibold text-gray-900">
            Resolver Alerta
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-900">{alert.productName ?? alert.productId}</p>
            <p className="text-gray-500 mt-1">
              Tipo: {alert.alertType} · Stock actual: {alert.currentStockLevel} · Umbral: {alert.alertThreshold}
            </p>
          </div>
          <div>
            <label htmlFor="resolve-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas de resolución <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              id="resolve-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Pedido realizado al proveedor, llegada estimada en 3 días…"
              className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes)}
            disabled={loading}
            aria-busy={loading}
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Resolviendo…' : 'Resolver'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Stats Card
// ----------------------------------------------------------------

interface StatsCardProps {
  label: string;
  value: number;
  variant: 'blue' | 'yellow' | 'orange' | 'red' | 'green';
}

function StatsCard({ label, value, variant }: StatsCardProps) {
  const classes: Record<StatsCardProps['variant'], string> = {
    blue:   'bg-blue-50 text-blue-700 ring-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
    red:    'bg-red-50 text-red-700 ring-red-200',
    green:  'bg-green-50 text-green-700 ring-green-200',
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

interface AlertDashboardProps {
  userRole: 'admin' | 'pharmacist' | 'cashier';
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function AlertDashboard({ userRole }: AlertDashboardProps) {
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [stats, setStats]           = useState<AlertStats | null>(null);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Resolve modal
  const [resolveTarget, setResolveTarget] = useState<Alert | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);

  const canResolve = userRole === 'admin' || userRole === 'pharmacist';

  // Filters
  const [filters, setFilters] = useState<AlertFilters>({
    alertType: '',
    resolved:  false,
    page:      1,
    limit:     20,
  });

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await alertsApi.getStats();
      setStats(data);
    } catch {
      // Non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters: AlertFilters = {
        page:  filters.page,
        limit: filters.limit,
      };
      if (filters.alertType) activeFilters.alertType = filters.alertType;
      if (filters.resolved !== '') activeFilters.resolved = filters.resolved;

      const result = await alertsApi.list(activeFilters);
      setAlerts(result.data);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar alertas.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  // ----------------------------------------------------------------
  // Resolve action
  // ----------------------------------------------------------------

  const handleResolveConfirm = async (notes: string) => {
    if (!resolveTarget) return;
    setResolveLoading(true);
    setActionError(null);
    try {
      await alertsApi.resolve(resolveTarget.id, notes || undefined);
      setResolveTarget(null);
      void fetchAlerts();
      void fetchStats();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al resolver la alerta.');
    } finally {
      setResolveLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // Filter helpers
  // ----------------------------------------------------------------

  const handleFilterChange = (key: keyof AlertFilters, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Panel de Alertas</h2>
        <p className="text-sm text-gray-500">Monitoreo de stock bajo y productos por vencer</p>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 flex-1 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="region" aria-label="Estadísticas de alertas">
          <StatsCard label="Alertas activas"  value={stats.active}              variant="blue"   />
          <StatsCard label="Stock bajo"       value={stats.byType.low_stock}    variant="yellow" />
          <StatsCard label="Por vencer"       value={stats.byType.expiring_soon} variant="orange" />
          <StatsCard label="Vencidos"         value={stats.byType.expired}      variant="red"    />
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-gray-50 p-4">
        {/* Alert type filter */}
        <div>
          <label htmlFor="alert-type-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Tipo de alerta
          </label>
          <select
            id="alert-type-filter"
            value={filters.alertType ?? ''}
            onChange={(e) => handleFilterChange('alertType', e.target.value as AlertType | '')}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="low_stock">Stock Bajo</option>
            <option value="expiring_soon">Por Vencer</option>
            <option value="expired">Vencido</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label htmlFor="resolved-filter" className="block text-xs font-medium text-gray-600 mb-1">
            Estado
          </label>
          <select
            id="resolved-filter"
            value={filters.resolved === '' ? '' : String(filters.resolved)}
            onChange={(e) => {
              const val = e.target.value;
              handleFilterChange('resolved', val === '' ? '' : val === 'true');
            }}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          >
            <option value="">Todos</option>
            <option value="false">Activas</option>
            <option value="true">Resueltas</option>
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
        <div className="flex justify-center py-8" aria-label="Cargando alertas">
          <svg className="h-8 w-8 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Alert list */}
      {!loading && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{total} alerta{total !== 1 ? 's' : ''}</p>

          {alerts.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              No hay alertas con los filtros seleccionados.
            </div>
          ) : (
            <ul role="list" className="space-y-2" aria-label="Lista de alertas">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`rounded-lg border p-4 ${
                    alert.resolvedTimestamp
                      ? 'border-gray-200 bg-white opacity-70'
                      : alert.alertType === 'expired'
                      ? 'border-red-200 bg-red-50'
                      : alert.alertType === 'expiring_soon'
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {alertTypeBadge(alert.alertType)}
                        {alert.resolvedTimestamp && (
                          <Badge label="Resuelta" variant="green" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {alert.productName ?? alert.productId}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span>
                          Stock actual: <strong>{alert.currentStockLevel}</strong>
                        </span>
                        <span>
                          Umbral: <strong>{alert.alertThreshold}</strong>
                        </span>
                        <span>
                          Generada: {formatDateTime(alert.alertTimestamp)}
                        </span>
                      </div>
                      {alert.supplierSuggestion && (
                        <p className="mt-1 text-xs text-indigo-600">
                          Proveedor sugerido: {alert.supplierSuggestion.supplierId}{' '}
                          ({alert.supplierSuggestion.reason === 'best_price' ? 'mejor precio' : 'menor tiempo de entrega'})
                        </p>
                      )}
                      {alert.resolvedTimestamp && (
                        <div className="mt-2 text-xs text-gray-500">
                          <p>
                            Resuelta por {alert.resolvedByName ?? alert.resolvedBy} el{' '}
                            {formatDateTime(alert.resolvedTimestamp)}
                          </p>
                          {alert.resolutionNotes && (
                            <p className="mt-0.5 italic">"{alert.resolutionNotes}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resolve button */}
                    {canResolve && !alert.resolvedTimestamp && (
                      <button
                        type="button"
                        onClick={() => setResolveTarget(alert)}
                        aria-label={`Resolver alerta de ${alert.productName ?? alert.productId}`}
                        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50"
                      >
                        Resolver
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
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

      {/* Resolve modal */}
      {resolveTarget && (
        <ResolveModal
          alert={resolveTarget}
          onConfirm={(notes) => void handleResolveConfirm(notes)}
          onCancel={() => setResolveTarget(null)}
          loading={resolveLoading}
        />
      )}
    </div>
  );
}
