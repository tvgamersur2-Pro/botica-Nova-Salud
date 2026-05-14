/**
 * TypeScript types for standardized API response structures.
 *
 * Success responses:  { data, meta? }
 * Error responses:    { error: { code, message, details?, timestamp, requestId } }
 *
 * Requirements: NFR-1.1, FR-5.5, NFR-4.2
 */

// ----------------------------------------------------------------
// Pagination meta
// ----------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ----------------------------------------------------------------
// Success response
// ----------------------------------------------------------------

/** Generic success response without pagination */
export interface ApiSuccessResponse<T = unknown> {
  data: T;
  meta?: Record<string, unknown>;
}

/** Success response with pagination metadata */
export interface ApiPaginatedResponse<T = unknown> {
  data: T[];
  meta: PaginationMeta & Record<string, unknown>;
}

// ----------------------------------------------------------------
// Error detail (field-level validation errors)
// ----------------------------------------------------------------

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

// ----------------------------------------------------------------
// Error response
// ----------------------------------------------------------------

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  timestamp: string;
  requestId: string;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

// ----------------------------------------------------------------
// Error categories
// ----------------------------------------------------------------

export type ApiErrorCategory =
  | 'VALIDATION_ERROR'       // 400 – invalid input / business rule violation
  | 'AUTHENTICATION_ERROR'   // 401 – missing / invalid / expired token
  | 'AUTHORIZATION_ERROR'    // 403 – insufficient permissions
  | 'NOT_FOUND'              // 404 – resource does not exist
  | 'RATE_LIMIT_EXCEEDED'    // 429 – too many requests
  | 'INTERNAL_ERROR';        // 500 – unexpected server error

/** Maps each error category to its default HTTP status code */
export const ERROR_STATUS_MAP: Record<ApiErrorCategory, number> = {
  VALIDATION_ERROR:     400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR:  403,
  NOT_FOUND:            404,
  RATE_LIMIT_EXCEEDED:  429,
  INTERNAL_ERROR:       500,
};
