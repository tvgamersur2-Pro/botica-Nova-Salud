/**
 * TypeScript types for Alert management in the frontend.
 * Requirements: DR-4, FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6, FR-3.7
 */

export type AlertType = 'low_stock' | 'expiring_soon' | 'expired';

export interface Alert {
  id: string;
  productId: string;
  productName?: string | null;
  alertType: AlertType;
  alertThreshold: number;
  currentStockLevel: number;
  alertTimestamp: string;
  resolvedTimestamp: string | null;
  resolvedBy: string | null;
  resolvedByName?: string | null;
  resolutionNotes: string | null;
  supplierSuggestion: {
    supplierId: string;
    reason: 'best_price' | 'shortest_lead_time';
  } | null;
}

export interface AlertStats {
  total: number;
  active: number;
  resolved: number;
  byType: {
    low_stock: number;
    expiring_soon: number;
    expired: number;
  };
}

// ----------------------------------------------------------------
// API response shapes
// ----------------------------------------------------------------

export interface AlertResponse {
  data: Alert;
}

export interface PaginatedAlertsResponse {
  data: Alert[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AlertStatsResponse {
  data: AlertStats;
}

// ----------------------------------------------------------------
// Filter / query options
// ----------------------------------------------------------------

export interface AlertFilters {
  alertType?: AlertType | '';
  resolved?: boolean | '';
  productId?: string;
  page?: number;
  limit?: number;
}
