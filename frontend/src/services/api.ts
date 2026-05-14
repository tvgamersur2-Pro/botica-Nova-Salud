/**
 * HTTP client for Nova Salud API.
 *
 * Features:
 *  - Base URL from environment variable
 *  - Request interceptor: attaches JWT access token from localStorage
 *  - Response interceptor: handles 401 by attempting token refresh,
 *    then redirecting to login on failure
 *
 * Requirements: FR-5.6, NFR-2.1
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type {
  User,
  CreateUserPayload,
  UpdateUserPayload,
  PaginatedUsersResponse,
  UserResponse,
  UserFilters,
  LoginPayload,
  LoginResponse,
} from '../types/user';

// ----------------------------------------------------------------
// Storage keys
// ----------------------------------------------------------------

const ACCESS_TOKEN_KEY  = 'nova_salud_access_token';
const REFRESH_TOKEN_KEY = 'nova_salud_refresh_token';

export const tokenStorage = {
  getAccessToken:  (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (access: string, refresh: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ----------------------------------------------------------------
// Axios instance
// ----------------------------------------------------------------

const BASE_URL = (import.meta as Record<string, unknown> & { env?: Record<string, string> })
  .env?.VITE_API_BASE_URL ?? '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ----------------------------------------------------------------
// Request interceptor – attach Bearer token
// ----------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ----------------------------------------------------------------
// Response interceptor – handle 401 / token refresh
// ----------------------------------------------------------------

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

function onRefreshed(newToken: string): void {
  pendingRequests.forEach((cb) => cb(newToken));
  pendingRequests = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401 and if we haven't already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefreshToken();

      if (!refreshToken) {
        tokenStorage.clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<{ data: { accessToken: string; expiresIn: number } }>(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
        );

        const newAccessToken = data.data.accessToken;
        tokenStorage.setTokens(newAccessToken, refreshToken);
        onRefreshed(newAccessToken);

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`;
        }

        return apiClient(originalRequest);
      } catch {
        tokenStorage.clearTokens();
        pendingRequests = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ----------------------------------------------------------------
// Auth API
// ----------------------------------------------------------------

export const authApi = {
  login: (payload: LoginPayload): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>('/auth/login', payload).then((r) => r.data),

  logout: (refreshToken: string): Promise<void> =>
    apiClient.post('/auth/logout', { refreshToken }).then(() => undefined),

  refresh: (refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> =>
    apiClient
      .post<{ data: { accessToken: string; expiresIn: number } }>('/auth/refresh', { refreshToken })
      .then((r) => r.data.data),
};

// ----------------------------------------------------------------
// Users API
// ----------------------------------------------------------------

export const usersApi = {
  /**
   * List users with optional filters and pagination.
   * Requirements: FR-1.1, FR-5.7
   */
  list: (filters: UserFilters = {}): Promise<PaginatedUsersResponse> => {
    const params: Record<string, string> = {};

    if (filters.role)                    params.role     = filters.role;
    if (filters.isActive !== undefined && filters.isActive !== '')
                                         params.isActive = String(filters.isActive);
    if (filters.search)                  params.search   = filters.search;
    if (filters.page !== undefined)      params.page     = String(filters.page);
    if (filters.limit !== undefined)     params.limit    = String(filters.limit);

    return apiClient
      .get<PaginatedUsersResponse>('/users', { params })
      .then((r) => r.data);
  },

  /**
   * Get a single user by ID.
   */
  getById: (id: string): Promise<User> =>
    apiClient.get<UserResponse>(`/users/${id}`).then((r) => r.data.data),

  /**
   * Create a new user (Admin only).
   */
  create: (payload: CreateUserPayload): Promise<User> =>
    apiClient.post<UserResponse>('/users', payload).then((r) => r.data.data),

  /**
   * Update an existing user (Admin only).
   */
  update: (id: string, payload: UpdateUserPayload): Promise<User> =>
    apiClient.put<UserResponse>(`/users/${id}`, payload).then((r) => r.data.data),

  /**
   * Deactivate a user – soft delete (Admin only).
   */
  deactivate: (id: string): Promise<User> =>
    apiClient.delete<UserResponse>(`/users/${id}`).then((r) => r.data.data),
};

export default apiClient;
