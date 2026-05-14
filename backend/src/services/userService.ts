/**
 * User Management Service (MySQL compatible)
 * Requirements: FR-1.1, FR-5.7, NFR-2.1
 */

import crypto from 'crypto';
import { query, withTransaction } from '../config/database';
import { hashPassword, validatePasswordStrength, AuthError } from './authService';
import { logger } from '../config/logger';
import type { UserRole } from '../types/auth';

export interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

export interface ListUsersOptions {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  data: UserRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number; };
}

export type Resource = 'users' | 'products' | 'transactions' | 'alerts' | 'reports' | 'audit_logs' | 'suppliers';
export type Action = 'read' | 'create' | 'update' | 'delete';

interface PermissionRule { resource: Resource; actions: Action[]; roles: UserRole[]; }

export const PERMISSION_RULES: PermissionRule[] = [
  { resource: 'users',        actions: ['read', 'create', 'update', 'delete'], roles: ['admin'] },
  { resource: 'products',     actions: ['read', 'create', 'update'],           roles: ['admin', 'pharmacist'] },
  { resource: 'products',     actions: ['delete'],                             roles: ['admin'] },
  { resource: 'transactions', actions: ['read', 'create'],                     roles: ['admin', 'pharmacist', 'cashier'] },
  { resource: 'alerts',       actions: ['read', 'update'],                     roles: ['admin', 'pharmacist'] },
  { resource: 'reports',      actions: ['read'],                               roles: ['admin', 'pharmacist'] },
  { resource: 'audit_logs',   actions: ['read'],                               roles: ['admin'] },
  { resource: 'suppliers',    actions: ['read', 'create', 'update'],           roles: ['admin', 'pharmacist'] },
  { resource: 'suppliers',    actions: ['delete'],                             roles: ['admin'] },
];

export function hasPermission(role: UserRole, resource: Resource, action: Action): boolean {
  return PERMISSION_RULES.some(
    (rule) => rule.resource === resource && rule.actions.includes(action) && rule.roles.includes(role),
  );
}

function rowToUserRecord(row: Record<string, unknown>): UserRecord {
  return {
    id:        row.id as string,
    username:  row.username as string,
    fullName:  row.full_name as string,
    email:     row.email as string,
    role:      row.role as UserRole,
    isActive:  row.is_active === 1 || row.is_active === true,
    lastLogin: row.last_login ? new Date(row.last_login as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

async function auditLog(
  actorId: string, action: string, affectedResourceId: string | null,
  beforeState: Record<string, unknown> | null, afterState: Record<string, unknown> | null,
  ipAddress?: string,
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, affected_resource_id, before_state, after_state, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, action, affectedResourceId ?? null,
       beforeState ? JSON.stringify(beforeState) : null,
       afterState  ? JSON.stringify(afterState)  : null,
       ipAddress   ?? null],
    );
  } catch (err) {
    logger.error('Failed to write audit log', { actorId, action, error: err instanceof Error ? err.message : String(err) });
  }
}

const VALID_ROLES: UserRole[] = ['admin', 'pharmacist', 'cashier'];

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserServiceError('Invalid email address format', 'VALIDATION_ERROR', 400);
  }
}

function validateUsername(username: string): void {
  if (username.length < 3 || username.length > 50) {
    throw new UserServiceError('Username must be between 3 and 50 characters', 'VALIDATION_ERROR', 400);
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    throw new UserServiceError('Username may only contain letters, numbers, underscores, dots, and hyphens', 'VALIDATION_ERROR', 400);
  }
}

export async function listUsers(options: ListUsersOptions = {}): Promise<PaginatedUsers> {
  const { role, isActive, search, page = 1, limit = 20 } = options;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (role !== undefined)     { conditions.push('role = ?');      params.push(role); }
  if (isActive !== undefined) { conditions.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (search) {
    conditions.push('(username LIKE ? OR full_name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users ${whereClause}`, params,
  );
  const total = parseInt(String(countResult.rows[0].count), 10);
  const offset = (page - 1) * limit;

  const dataResult = await query<Record<string, unknown>>(
    `SELECT id, username, full_name, email, role, is_active, last_login, created_at
     FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { data: dataResult.rows.map(rowToUserRecord), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getUserById(id: string): Promise<UserRecord> {
  const result = await query<Record<string, unknown>>(
    `SELECT id, username, full_name, email, role, is_active, last_login, created_at FROM users WHERE id = $1`, [id],
  );
  if (result.rowCount === 0) throw new UserServiceError('User not found', 'NOT_FOUND', 404);
  return rowToUserRecord(result.rows[0]);
}

export async function createUser(input: CreateUserInput, actorId: string, ipAddress?: string): Promise<UserRecord> {
  const { username, password, fullName, email, role } = input;

  if (!username?.trim()) throw new UserServiceError('Username is required', 'VALIDATION_ERROR', 400);
  if (!fullName?.trim())  throw new UserServiceError('Full name is required', 'VALIDATION_ERROR', 400);
  if (!email?.trim())     throw new UserServiceError('Email is required', 'VALIDATION_ERROR', 400);
  if (!role || !VALID_ROLES.includes(role)) throw new UserServiceError(`Role must be one of: ${VALID_ROLES.join(', ')}`, 'VALIDATION_ERROR', 400);

  validateUsername(username.trim());
  validateEmail(email.trim().toLowerCase());

  try { validatePasswordStrength(password); }
  catch (err) { if (err instanceof AuthError) throw new UserServiceError(err.message, 'VALIDATION_ERROR', 400); throw err; }

  const existingResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users WHERE username = $1 OR email = $2`,
    [username.trim(), email.trim().toLowerCase()],
  );
  if (parseInt(String(existingResult.rows[0].count), 10) > 0) {
    throw new UserServiceError('A user with that username or email already exists', 'CONFLICT', 409);
  }

  const passwordHash = await hashPassword(password);
  const newId = crypto.randomUUID();

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [newId, username.trim(), passwordHash, fullName.trim(), email.trim().toLowerCase(), role],
    );
  });

  const newUser = await getUserById(newId);
  await auditLog(actorId, 'USER_CREATED', newUser.id, null, { username: newUser.username, email: newUser.email, role: newUser.role }, ipAddress);
  logger.info('User created', { actorId, newUserId: newUser.id });
  return newUser;
}

export async function updateUser(id: string, input: UpdateUserInput, actorId: string, ipAddress?: string): Promise<UserRecord> {
  const current = await getUserById(id);
  const { fullName, email, role, isActive, password } = input;

  if (email !== undefined) validateEmail(email.trim().toLowerCase());
  if (role !== undefined && !VALID_ROLES.includes(role)) throw new UserServiceError(`Role must be one of: ${VALID_ROLES.join(', ')}`, 'VALIDATION_ERROR', 400);
  if (password !== undefined) {
    try { validatePasswordStrength(password); }
    catch (err) { if (err instanceof AuthError) throw new UserServiceError(err.message, 'VALIDATION_ERROR', 400); throw err; }
  }

  if (email !== undefined && email.trim().toLowerCase() !== current.email) {
    const emailCheck = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM users WHERE email = $1 AND id != $2`, [email.trim().toLowerCase(), id]);
    if (parseInt(String(emailCheck.rows[0].count), 10) > 0) throw new UserServiceError('A user with that email already exists', 'CONFLICT', 409);
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (fullName !== undefined) { setClauses.push('full_name = ?');     params.push(fullName.trim()); }
  if (email    !== undefined) { setClauses.push('email = ?');         params.push(email.trim().toLowerCase()); }
  if (role     !== undefined) { setClauses.push('role = ?');          params.push(role); }
  if (isActive !== undefined) { setClauses.push('is_active = ?');     params.push(isActive ? 1 : 0); }
  if (password !== undefined) {
    const newHash = await hashPassword(password);
    setClauses.push('password_hash = ?');
    params.push(newHash);
  }

  if (setClauses.length === 0) throw new UserServiceError('No fields to update', 'VALIDATION_ERROR', 400);

  params.push(id);
  await withTransaction(async (client) => {
    await client.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`, params);
  });

  const updated = await getUserById(id);
  const beforeState = { fullName: current.fullName, email: current.email, role: current.role, isActive: current.isActive };
  const afterState: Record<string, unknown> = { fullName: updated.fullName, email: updated.email, role: updated.role, isActive: updated.isActive };
  if (password !== undefined) afterState.passwordChanged = true;

  await auditLog(actorId, 'USER_UPDATED', id, beforeState, afterState, ipAddress);
  logger.info('User updated', { actorId, targetUserId: id });
  return updated;
}

export async function deactivateUser(id: string, actorId: string, ipAddress?: string): Promise<UserRecord> {
  if (id === actorId) throw new UserServiceError('You cannot deactivate your own account', 'FORBIDDEN', 403);

  const current = await getUserById(id);
  if (!current.isActive) throw new UserServiceError('User is already inactive', 'CONFLICT', 409);

  await withTransaction(async (client) => {
    await client.query(`UPDATE users SET is_active = 0 WHERE id = ?`, [id]);
    await client.query('DELETE FROM sessions WHERE user_id = ?', [id]);
  });

  const updated = await getUserById(id);
  await auditLog(actorId, 'USER_DEACTIVATED', id, { isActive: true }, { isActive: false }, ipAddress);
  logger.info('User deactivated', { actorId, targetUserId: id });
  return updated;
}

export class UserServiceError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number) {
    super(message);
    this.name = 'UserServiceError';
  }
}
