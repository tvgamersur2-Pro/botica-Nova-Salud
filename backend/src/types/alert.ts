/**
 * TypeScript types for Alert management.
 * Requirements: DR-4, FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6, FR-3.7
 */

export type AlertType = 'low_stock' | 'expiring_soon' | 'expired';

export interface AlertRecord {
  id: string;
  productId: string;
  alertType: AlertType;
  alertThreshold: number;
  currentStockLevel: number;
  alertTimestamp: Date;
  resolvedTimestamp: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  supplierSuggestion: {
    supplierId: string;
    reason: 'best_price' | 'shortest_lead_time';
  } | null;
  /** Populated via JOIN */
  productName?: string | null;
  resolvedByName?: string | null;
}

export interface CreateAlertInput {
  productId: string;
  alertType: AlertType;
  alertThreshold: number;
  currentStockLevel: number;
  supplierSuggestion?: {
    supplierId: string;
    reason: 'best_price' | 'shortest_lead_time';
  } | null;
}

export interface ListAlertsOptions {
  alertType?: AlertType;
  resolved?: boolean;
  productId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAlerts {
  data: AlertRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
