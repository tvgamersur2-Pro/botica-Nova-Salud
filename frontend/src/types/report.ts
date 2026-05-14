/**
 * TypeScript types for Report management in the frontend.
 * Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6
 */

export interface DateRange {
  from: string;
  to: string;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  total: number;
}

export interface SalesReport {
  dateRange: DateRange;
  totalSales: number;
  transactionCount: number;
  topSellingProducts: TopProduct[];
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  generatedAt: string;
}

export interface InventoryReportItem {
  id: string;
  name: string;
  dosage: string | null;
  form: string;
  category: string;
  quantityInStock: number;
  minStockThreshold: number;
  unitPrice: number;
  expirationDate: string;
  supplierName: string | null;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

export interface InventoryReport {
  totalProducts: number;
  lowStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  items: InventoryReportItem[];
  generatedAt: string;
}

export interface SalesReportFilters {
  from: string;
  to: string;
}

export interface InventoryReportFilters {
  category?: string;
  supplierId?: string;
}
