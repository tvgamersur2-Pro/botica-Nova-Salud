/**
 * API client for Report generation and export.
 * Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6
 */

import apiClient from './api';
import type {
  SalesReport,
  InventoryReport,
  SalesReportFilters,
  InventoryReportFilters,
} from '../types/report';

export const reportsApi = {
  /**
   * Generate a sales report for the given date range.
   * Requirements: FR-4.1, FR-4.2, FR-4.3
   */
  getSalesReport: (filters: SalesReportFilters): Promise<SalesReport> =>
    apiClient
      .get<{ data: SalesReport }>('/reports/sales', {
        params: { startDate: filters.from, endDate: filters.to },
      })
      .then((r) => r.data.data),

  /**
   * Generate an inventory status report.
   * Requirements: FR-4.4, FR-4.5
   */
  getInventoryReport: (filters: InventoryReportFilters = {}): Promise<InventoryReport> =>
    apiClient
      .get<{ data: InventoryReport }>('/reports/inventory', { params: filters })
      .then((r) => r.data.data),

  /**
   * Export sales report as CSV.
   * Requirements: FR-4.6, Property 12
   */
  exportSalesCSV: (filters: SalesReportFilters): Promise<Blob> =>
    apiClient
      .get('/reports/sales/export', {
        params: { startDate: filters.from, endDate: filters.to, format: 'csv' },
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),

  /**
   * Export inventory report as CSV.
   * Requirements: FR-4.6, Property 12
   */
  exportInventoryCSV: (filters: InventoryReportFilters = {}): Promise<Blob> =>
    apiClient
      .get('/reports/inventory/export', {
        params: { ...filters, format: 'csv' },
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),
};
