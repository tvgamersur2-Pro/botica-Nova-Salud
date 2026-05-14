/**
 * API client for Alert management.
 *
 * Uses the shared axios instance from api.ts which handles
 * authentication tokens and token refresh automatically.
 *
 * Requirements: FR-3.3, FR-3.4, FR-3.5, FR-3.6
 */

import apiClient from './api';
import type {
  Alert,
  AlertStats,
  PaginatedAlertsResponse,
  AlertResponse,
  AlertStatsResponse,
  AlertFilters,
} from '../types/alert';

export const alertsApi = {
  /**
   * List alerts with optional filters and pagination.
   * Requirements: FR-3.3, FR-3.4
   */
  list: (filters: AlertFilters = {}): Promise<PaginatedAlertsResponse> => {
    const params: Record<string, string> = {};

    if (filters.alertType)              params.alertType  = filters.alertType;
    if (filters.resolved !== undefined && filters.resolved !== '')
                                        params.resolved   = String(filters.resolved);
    if (filters.productId)              params.productId  = filters.productId;
    if (filters.page !== undefined)     params.page       = String(filters.page);
    if (filters.limit !== undefined)    params.limit      = String(filters.limit);

    return apiClient
      .get<PaginatedAlertsResponse>('/alerts', { params })
      .then((r) => r.data);
  },

  /**
   * Get a single alert by ID.
   * Requirements: FR-3.3
   */
  getById: (id: string): Promise<Alert> =>
    apiClient
      .get<AlertResponse>(`/alerts/${id}`)
      .then((r) => r.data.data),

  /**
   * Resolve an alert.
   * Requirements: FR-3.5, FR-3.6
   */
  resolve: (id: string, notes?: string): Promise<Alert> =>
    apiClient
      .put<AlertResponse>(`/alerts/${id}/resolve`, { notes })
      .then((r) => r.data.data),

  /**
   * Get alert statistics.
   * Requirements: FR-3.3
   */
  getStats: (): Promise<AlertStats> =>
    apiClient
      .get<AlertStatsResponse>('/alerts/stats')
      .then((r) => r.data.data),
};

export default alertsApi;
