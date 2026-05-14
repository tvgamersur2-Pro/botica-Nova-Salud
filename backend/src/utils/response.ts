/**
 * Helper functions for building standardized API responses.
 *
 * Usage:
 *   res.status(200).json(success(data));
 *   res.status(200).json(paginated(items, { page, limit, total }));
 *   res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', requestId, details));
 *
 * Requirements: NFR-1.1
 */

import type { Response } from 'express';
import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiErrorResponse,
  ApiErrorDetail,
  ApiErrorCategory,
  PaginationMeta,
} from '../types/api';
import { ERROR_STATUS_MAP } from '../types/api';

// ----------------------------------------------------------------
// Success helpers
// ----------------------------------------------------------------

/**
 * Builds a standard success response body.
 *
 * @param data    - The response payload
 * @param meta    - Optional extra metadata (non-pagination)
 */
export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = { data };
  if (meta && Object.keys(meta).length > 0) {
    response.meta = meta;
  }
  return response;
}

/**
 * Builds a paginated success response body.
 *
 * @param data    - Array of items for the current page
 * @param pagination - Page, limit, and total count
 * @param extra   - Optional additional metadata fields
 */
export function paginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number },
  extra?: Record<string, unknown>,
): ApiPaginatedResponse<T> {
  const { page, limit, total } = pagination;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  const meta: PaginationMeta & Record<string, unknown> = {
    page,
    limit,
    total,
    totalPages,
    ...extra,
  };

  return { data, meta };
}

// ----------------------------------------------------------------
// Error helpers
// ----------------------------------------------------------------

/**
 * Builds a standard error response body.
 *
 * @param code      - Machine-readable error code (e.g. 'VALIDATION_ERROR')
 * @param message   - Human-readable error message
 * @param requestId - Unique request identifier (from req.id)
 * @param details   - Optional field-level validation details
 */
export function errorBody(
  code: string,
  message: string,
  requestId: string,
  details?: ApiErrorDetail[],
): ApiErrorResponse {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  if (details && details.length > 0) {
    body.error.details = details;
  }

  return body;
}

// ----------------------------------------------------------------
// Express response senders
// ----------------------------------------------------------------

/**
 * Sends a 200 OK success response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
  statusCode = 200,
): void {
  res.status(statusCode).json(success(data, meta));
}

/**
 * Sends a 201 Created success response.
 */
export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(success(data));
}

/**
 * Sends a paginated 200 OK response.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number },
  extra?: Record<string, unknown>,
): void {
  res.status(200).json(paginated(data, pagination, extra));
}

/**
 * Sends an error response using the standard error category.
 * The HTTP status code is derived from the category.
 */
export function sendError(
  res: Response,
  category: ApiErrorCategory,
  message: string,
  requestId: string,
  details?: ApiErrorDetail[],
  customCode?: string,
): void {
  const statusCode = ERROR_STATUS_MAP[category];
  const code = customCode ?? category;
  res.status(statusCode).json(errorBody(code, message, requestId, details));
}
