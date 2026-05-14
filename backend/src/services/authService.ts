/**
 * Authentication Service
 *
 * Business logic for:
 *  - User login with bcrypt password verification          (FR-6.1, FR-6.2, NFR-2.2)
 *  - JWT access + refresh token generation/validation     (FR-5.6, NFR-2.3)
 *  - Session storage in PostgreSQL sessions table         (FR-5.6, NFR-2.3)
 *  - Account lockout after 5 consecutive failed attempts  (NFR-2.3)
 *  - Password reset flow                                  (NFR-2.4)
 *  - Audit logging of all auth events                     (FR-6.4)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, withTransaction } from '../config/database';
import { logger } from '../config/logger';
import type {
  User,
  PublicUser,
  JWTPayload,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  Session,
} from '../types/auth';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '30m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const ACCESS_TOKEN_SECONDS = 30 * 60; // 30 minutes in seconds
const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Map a DB row to the User interface */
function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    fullName: row.full_name as string,
    email: row.email as string,
    role: row.role as User['role'],
    // MySQL returns TINYINT(1) as 1/0, convert to boolean
    isActive: row.is_active === 1 || row.is_active === true,
    lastLogin: row.last_login ? new Date(row.last_login as string) : null,
    createdAt: new Date(row.created_at as string),
    failedLoginAttempts: (row.failed_login_attempts as number) ?? 0,
    lockedUntil: row.locked_until ? new Date(row.locked_until as string) : null,
  };
}

/** Strip the password hash before returning user data to callers */
function toPublicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _ph, ...pub } = user;
  return pub;
}

/** Generate a signed JWT */
function signToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresIn: string,
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

/** Log an authentication event to audit_logs */
async function logAuthEvent(
  userId: string,
  action: string,
  ipAddress?: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, ip_address)
       VALUES ($1, $2, $3)`,
      [userId, action, ipAddress ?? null],
    );
  } catch (err) {
    // Audit log failure must not break the auth flow
    logger.error('Failed to write audit log', {
      userId,
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Authenticate a user with username + password.
 *
 * Security notes:
 *  - Generic error messages prevent user-enumeration attacks.
 *  - Failed attempts are tracked; account is locked after 5 failures.
 *  - All attempts (success and failure) are logged.
 *
 * Requirements: FR-6.1, FR-6.2, NFR-2.2, NFR-2.3
 */
export async function login(
  req: LoginRequest,
  ipAddress?: string,
): Promise<LoginResponse> {
  const { username, password } = req;

  // 1. Fetch user by username
  const userResult = await query<Record<string, unknown>>(
    `SELECT id, username, password_hash, full_name, email, role,
            is_active, last_login, created_at,
            failed_login_attempts, locked_until
     FROM users
     WHERE username = $1`,
    [username],
  );

  // Generic error – do not reveal whether the user exists
  const GENERIC_ERROR = 'Invalid credentials';

  if (userResult.rowCount === 0) {
    logger.warn('Login attempt for unknown username', { username, ipAddress });
    throw new AuthError(GENERIC_ERROR, 'INVALID_CREDENTIALS', 401);
  }

  const user = rowToUser(userResult.rows[0]);

  // 2. Check account is active
  if (!user.isActive) {
    logger.warn('Login attempt on inactive account', { userId: user.id, ipAddress });
    throw new AuthError(GENERIC_ERROR, 'INVALID_CREDENTIALS', 401);
  }

  // 3. Check account lockout (NFR-2.3)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    logger.warn('Login attempt on locked account', { userId: user.id, ipAddress });
    throw new AuthError(
      'Account is temporarily locked. Please try again later.',
      'ACCOUNT_LOCKED',
      423,
    );
  }

  // 4. Verify password with bcrypt
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    await handleFailedLogin(user, ipAddress);
    throw new AuthError(GENERIC_ERROR, 'INVALID_CREDENTIALS', 401);
  }

  // 5. Successful login – reset failed attempts and update last_login
  await query(
    `UPDATE users
     SET failed_login_attempts = 0,
         locked_until          = NULL,
         last_login            = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [user.id],
  );

  // 6. Generate tokens
  const accessToken = signToken(
    { userId: user.id, username: user.username, role: user.role, type: 'access' },
    ACCESS_TOKEN_EXPIRES_IN,
  );
  const refreshToken = signToken(
    { userId: user.id, username: user.username, role: user.role, type: 'refresh' },
    REFRESH_TOKEN_EXPIRES_IN,
  );

  // 7. Persist refresh token as a session
  await createSession(user.id, refreshToken, REFRESH_TOKEN_SECONDS);

  // 8. Audit log
  await logAuthEvent(user.id, 'LOGIN_SUCCESS', ipAddress);
  logger.info('User logged in successfully', { userId: user.id, username: user.username });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_SECONDS,
    user: toPublicUser({ ...user, failedLoginAttempts: 0, lockedUntil: null }),
  };
}

/**
 * Increment failed login counter; lock account after MAX_FAILED_ATTEMPTS.
 */
async function handleFailedLogin(user: User, ipAddress?: string): Promise<void> {
  const newAttempts = user.failedLoginAttempts + 1;
  const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
    : null;

  await query(
    `UPDATE users
     SET failed_login_attempts = $1,
         locked_until          = $2
     WHERE id = $3`,
    [newAttempts, lockedUntil, user.id],
  );

  await logAuthEvent(user.id, 'LOGIN_FAILED', ipAddress);

  if (shouldLock) {
    logger.warn('Account locked after too many failed attempts', {
      userId: user.id,
      attempts: newAttempts,
    });
  } else {
    logger.warn('Failed login attempt', {
      userId: user.id,
      attempts: newAttempts,
      ipAddress,
    });
  }
}

/**
 * Refresh an access token using a valid refresh token.
 *
 * Requirements: FR-5.6, NFR-2.3
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  // 1. Verify JWT signature and expiry
  let payload: JWTPayload;
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as JWTPayload;
  } catch {
    throw new AuthError('Invalid or expired refresh token', 'INVALID_TOKEN', 401);
  }

  if (payload.type !== 'refresh') {
    throw new AuthError('Invalid token type', 'INVALID_TOKEN', 401);
  }

  // 2. Verify session exists in DB (not logged out)
  const sessionResult = await query<Record<string, unknown>>(
    `SELECT id FROM sessions
     WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [refreshToken],
  );

  if (sessionResult.rowCount === 0) {
    throw new AuthError('Session not found or expired', 'SESSION_EXPIRED', 401);
  }

  // 3. Issue new access token
  const accessToken = signToken(
    { userId: payload.userId, username: payload.username, role: payload.role, type: 'access' },
    ACCESS_TOKEN_EXPIRES_IN,
  );

  logger.info('Access token refreshed', { userId: payload.userId });

  return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS };
}

/**
 * Invalidate a session (logout).
 *
 * Requirements: FR-5.6, NFR-2.3
 */
export async function logout(
  refreshToken: string,
  ipAddress?: string,
): Promise<void> {
  // Decode without verifying so we can still log even if token is expired
  let userId: string | undefined;
  try {
    const decoded = jwt.decode(refreshToken) as JWTPayload | null;
    userId = decoded?.userId;
  } catch {
    // ignore
  }

  await query('DELETE FROM sessions WHERE token = $1', [refreshToken]);

  if (userId) {
    await logAuthEvent(userId, 'LOGOUT', ipAddress);
    logger.info('User logged out', { userId });
  }
}

/**
 * Validate an access token and return its payload.
 * Used by the auth middleware.
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (payload.type !== 'access') {
      throw new AuthError('Invalid token type', 'INVALID_TOKEN', 401);
    }
    return payload;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired token', 'INVALID_TOKEN', 401);
  }
}

// ----------------------------------------------------------------
// Session helpers
// ----------------------------------------------------------------

async function createSession(
  userId: string,
  token: string,
  ttlSeconds: number,
): Promise<Session> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO sessions (id, user_id, token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [id, userId, token, expiresAt],
  );
  return {
    id,
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  };
}

// ----------------------------------------------------------------
// Password reset
// ----------------------------------------------------------------

/**
 * Initiate a password reset: generate a secure token and store it.
 *
 * Requirements: NFR-2.4
 *
 * Note: The response is always generic to prevent email enumeration.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const userResult = await query<Record<string, unknown>>(
    'SELECT id FROM users WHERE email = $1 AND is_active = 1',
    [email],
  );

  if (userResult.rowCount === 0) {
    // Do not reveal whether the email exists
    logger.info('Password reset requested for unknown/inactive email', { email });
    return;
  }

  const userId = userResult.rows[0].id as string;
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

  // Store the hashed reset token in the sessions table with a special prefix
  const hashedToken = await bcrypt.hash(resetToken, 10);

  await query(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, `reset:${hashedToken}`, expiresAt],
  );

  await logAuthEvent(userId, 'PASSWORD_RESET_REQUESTED');

  // In production this would send an email; for now we log the token
  logger.info('Password reset token generated', {
    userId,
    // Only log in non-production environments
    ...(process.env.NODE_ENV !== 'production' && { resetToken }),
  });
}

/**
 * Confirm a password reset using the token and new password.
 *
 * Requirements: NFR-2.4
 */
export async function confirmPasswordReset(
  resetToken: string,
  newPassword: string,
): Promise<void> {
  // Validate password strength (NFR-2.2)
  validatePasswordStrength(newPassword);

  // Find all active reset sessions and check each one
  const sessionsResult = await query<Record<string, unknown>>(
    `SELECT id, user_id, token
     FROM sessions
     WHERE token LIKE 'reset:%' AND expires_at > CURRENT_TIMESTAMP`,
  );

  let matchedSession: { id: string; userId: string } | null = null;

  for (const row of sessionsResult.rows) {
    const storedHash = (row.token as string).replace('reset:', '');
    const matches = await bcrypt.compare(resetToken, storedHash);
    if (matches) {
      matchedSession = { id: row.id as string, userId: row.user_id as string };
      break;
    }
  }

  if (!matchedSession) {
    throw new AuthError('Invalid or expired reset token', 'INVALID_TOKEN', 400);
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await withTransaction(async (client) => {
    // Update password and reset lockout state
    await client.query(
      `UPDATE users
       SET password_hash          = $1,
           failed_login_attempts  = 0,
           locked_until           = NULL
       WHERE id = $2`,
      [newHash, matchedSession!.userId],
    );

    // Invalidate the reset token
    await client.query('DELETE FROM sessions WHERE id = $1', [matchedSession!.id]);

    // Invalidate all other sessions for this user (force re-login)
    await client.query('DELETE FROM sessions WHERE user_id = $1', [matchedSession!.userId]);
  });

  await logAuthEvent(matchedSession.userId, 'PASSWORD_RESET_CONFIRMED');
  logger.info('Password reset completed', { userId: matchedSession.userId });
}

// ----------------------------------------------------------------
// Password validation
// ----------------------------------------------------------------

/**
 * Enforce password policy: min 8 chars, uppercase, lowercase, number.
 * Requirements: NFR-2.2
 */
export function validatePasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new AuthError(
      'Password must be at least 8 characters long',
      'WEAK_PASSWORD',
      400,
    );
  }
  if (!/[A-Z]/.test(password)) {
    throw new AuthError(
      'Password must contain at least one uppercase letter',
      'WEAK_PASSWORD',
      400,
    );
  }
  if (!/[a-z]/.test(password)) {
    throw new AuthError(
      'Password must contain at least one lowercase letter',
      'WEAK_PASSWORD',
      400,
    );
  }
  if (!/[0-9]/.test(password)) {
    throw new AuthError(
      'Password must contain at least one number',
      'WEAK_PASSWORD',
      400,
    );
  }
}

/**
 * Hash a plain-text password with bcrypt.
 * Utility used by user-creation flows.
 */
export async function hashPassword(plainText: string): Promise<string> {
  validatePasswordStrength(plainText);
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

// ----------------------------------------------------------------
// Custom error class
// ----------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
