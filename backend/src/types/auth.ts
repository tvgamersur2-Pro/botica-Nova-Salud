/**
 * TypeScript types for the Authentication module.
 * Requirements: FR-6.1, FR-6.2, FR-5.6, NFR-2.2, NFR-2.3
 */

// ----------------------------------------------------------------
// User / Role types
// ----------------------------------------------------------------

export type UserRole = 'admin' | 'pharmacist' | 'cashier';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  /** Number of consecutive failed login attempts */
  failedLoginAttempts: number;
  /** Timestamp when the account was locked (null = not locked) */
  lockedUntil: Date | null;
}

/** Public-facing user data (no password hash) */
export type PublicUser = Omit<User, 'passwordHash'>;

// ----------------------------------------------------------------
// JWT payload
// ----------------------------------------------------------------

export interface JWTPayload {
  /** User UUID */
  userId: string;
  username: string;
  role: UserRole;
  /** Token type: access or refresh */
  type: 'access' | 'refresh';
  /** Issued-at (Unix seconds) – added by jsonwebtoken automatically */
  iat?: number;
  /** Expiration (Unix seconds) – added by jsonwebtoken automatically */
  exp?: number;
}

// ----------------------------------------------------------------
// Request / Response shapes
// ----------------------------------------------------------------

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
  user: PublicUser;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

// ----------------------------------------------------------------
// Session (mirrors the DB sessions table)
// ----------------------------------------------------------------

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// ----------------------------------------------------------------
// Middleware augmentation
// ----------------------------------------------------------------

/** Attached to req.user by the auth middleware after token validation */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: UserRole;
}

// Extend Express Request so TypeScript knows about req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
