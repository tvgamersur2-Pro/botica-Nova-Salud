/**
 * AuditLogViewer Component
 *
 * Displays audit logs with filtering by user, action, and date range.
 * Only accessible to Admin role.
 *
 * Requirements: FR-6.4, FR-6.5, FR-5.1, FR-5.3
 */

import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/api';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  action: string;
  timestamp: string;
  affectedResourceId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  ipAddress: string | null;
}

interface AuditFilters {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

interface PaginatedAuditLogs {
  data: AuditLog[];
  meta: { page: number; limit: number; total: number; totalPages: number; };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function getActionVariant(action: string): string {
  if (action.includes('DELETE') || action.includes('DEACTIVAT') || action.includes('VOID')) {
    return 'bg-red-100 text-red-800';
  }
  if (action.includes('CREATE') || action.includes('LOGIN_SUCCESS')) {
    return 'bg-green-100 text-green-800';
  }
  if (action.includes('UPDATE') || action.includes('REFUND') || action.includes('RESOLVE')) {
    return 'bg-blue-100 text-blue-800';
  }
  if (action.includes('FAIL') || action.includes('LOCKED')) {
    return 'bg-yellow-100 text-yellow-800';
  }
  return 'bg-gray-100 text-gray-700';
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function AuditLogViewer() {
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState<AuditFilters>({
    action:    '',
    startDate: '',
    endDate:   '',
    page:      1,
    limit:     25,
  });

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page:  String(filters.page),
        limit: String(filters.limit),
      };
      if (filters.action)    params.action    = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate)   params.endDate   = filters.endDate;

      const result = await apiClient
        .get<PaginatedAuditLogs>('/audit-logs', { params })
        .then((r) => r.data);

      setLogs(result.data);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los logs de auditoría.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // ----------------------------------------------------------------
  // Filter helpers
  // ----------------------------------------------------------------

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
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
        <h2 className="text-xl font-semibold text-gray-900">Logs de Auditoría</h2>
        <p className="text-sm text-gray-500">{total} registro{total !== 1 ? 's' : ''} en total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-gray-50 p-4">
        <div>
          <label htmlFor="audit-action" className="block text-xs font-medium text-gray-600 mb-1">
            Acción
          </label>
          <input
            id="audit-action"
            type="text"
            placeholder="Ej: USER_CREATED"
            value={filters.action ?? ''}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="audit-from" className="block text-xs font-medium text-gray-600 mb-1">
            Desde
          </label>
          <input
            id="audit-from"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="audit-to" className="block text-xs font-medium text-gray-600 mb-1">
            Hasta
          </label>
          <input
            id="audit-to"
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8" aria-label="Cargando logs">
          <svg className="h-8 w-8 animate-spin text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Logs de auditoría">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Fecha/Hora</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Acción</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Usuario</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">IP</th>
                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Detalles</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                    No se encontraron registros.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionVariant(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {log.userName ?? log.userId.slice(0, 8) + '…'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        {log.ipAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(log.beforeState || log.afterState) && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            aria-expanded={expandedId === log.id}
                            aria-label={`${expandedId === log.id ? 'Ocultar' : 'Ver'} detalles del log`}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            {expandedId === log.id ? 'Ocultar' : 'Detalles'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-4 py-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                            {log.beforeState && (
                              <div>
                                <p className="font-semibold text-gray-600 mb-1">Antes:</p>
                                <pre className="rounded bg-white p-2 ring-1 ring-gray-200 overflow-auto max-h-32 text-gray-700">
                                  {JSON.stringify(log.beforeState, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.afterState && (
                              <div>
                                <p className="font-semibold text-gray-600 mb-1">Después:</p>
                                <pre className="rounded bg-white p-2 ring-1 ring-gray-200 overflow-auto max-h-32 text-gray-700">
                                  {JSON.stringify(log.afterState, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
              disabled={filters.page <= 1}
              onClick={() => handlePageChange(filters.page - 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => handlePageChange(filters.page + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
