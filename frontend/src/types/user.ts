/**
 * TypeScript types for User Management in the frontend.
 * Requirements: FR-1.1, FR-5.7, DR-3
 */

// ----------------------------------------------------------------
// Core types
// ----------------------------------------------------------------

export type UserRole = 'admin' | 'pharmacist' | 'cashier';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null; // ISO date string from API
  createdAt: string;        // ISO date string from API
}

// ----------------------------------------------------------------
// API request/response shapes
// ----------------------------------------------------------------

export interface CreateUserPayload {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

export interface PaginatedUsersResponse {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserResponse {
  data: User;
}

// ----------------------------------------------------------------
// Filter / query options
// ----------------------------------------------------------------

export interface UserFilters {
  role?: UserRole | '';
  isActive?: boolean | '';
  search?: string;
  page?: number;
  limit?: number;
}

// ----------------------------------------------------------------
// Auth context types (used by the app shell)
// ----------------------------------------------------------------

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: User;
  };
}
