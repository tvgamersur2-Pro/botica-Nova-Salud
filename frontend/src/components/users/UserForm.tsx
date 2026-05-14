/**
 * UserForm Component
 *
 * Modal form for creating or editing a user.
 * Only accessible to Admin role.
 *
 * Requirements: FR-5.1, FR-5.3, FR-5.7
 */

import React, { useEffect, useState } from 'react';
import { usersApi } from '../../services/api';
import type {
  User,
  UserRole,
  CreateUserPayload,
  UpdateUserPayload,
} from '../../types/user';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface FormState {
  username: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

interface FieldError {
  username?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  email?: string;
  role?: string;
}

interface UserFormProps {
  /** If provided, the form is in "edit" mode; otherwise "create" mode */
  user?: User | null;
  /** Called after a successful save */
  onSuccess: (savedUser: User) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

// ----------------------------------------------------------------
// Validation helpers
// ----------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validate(state: FormState, isEdit: boolean): FieldError {
  const errors: FieldError = {};

  if (!isEdit) {
    if (!state.username.trim()) {
      errors.username = 'Username is required';
    } else if (state.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(state.username.trim())) {
      errors.username = 'Username may only contain letters, numbers, underscores, dots, and hyphens';
    }
  }

  if (!state.fullName.trim()) {
    errors.fullName = 'Full name is required';
  }

  if (!state.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(state.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (!state.role) {
    errors.role = 'Role is required';
  }

  // Password is required on create; optional on edit
  if (!isEdit || state.password) {
    if (!state.password) {
      errors.password = 'Password is required';
    } else if (!PASSWORD_REGEX.test(state.password)) {
      errors.password =
        'Password must be at least 8 characters and include uppercase, lowercase, and a number';
    }

    if (state.password !== state.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
  }

  return errors;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const isEdit = Boolean(user);

  const [form, setForm] = useState<FormState>({
    username:        user?.username        ?? '',
    password:        '',
    confirmPassword: '',
    fullName:        user?.fullName        ?? '',
    email:           user?.email           ?? '',
    role:            user?.role            ?? 'cashier',
    isActive:        user?.isActive        ?? true,
  });

  const [errors, setErrors]     = useState<FieldError>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  // Reset form when the user prop changes (e.g. opening a different user)
  useEffect(() => {
    setForm({
      username:        user?.username  ?? '',
      password:        '',
      confirmPassword: '',
      fullName:        user?.fullName  ?? '',
      email:           user?.email     ?? '',
      role:            user?.role      ?? 'cashier',
      isActive:        user?.isActive  ?? true,
    });
    setErrors({});
    setApiError(null);
  }, [user]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setForm((prev: FormState) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear field error on change
    if (errors[name as keyof FieldError]) {
      setErrors((prev: FieldError) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const fieldErrors = validate(form, isEdit);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      let savedUser: User;

      if (isEdit && user) {
        const payload: UpdateUserPayload = {
          fullName: form.fullName.trim(),
          email:    form.email.trim().toLowerCase(),
          role:     form.role,
          isActive: form.isActive,
        };
        if (form.password) {
          payload.password = form.password;
        }
        savedUser = await usersApi.update(user.id, payload);
      } else {
        const payload: CreateUserPayload = {
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          email:    form.email.trim().toLowerCase(),
          role:     form.role,
        };
        savedUser = await usersApi.create(payload);
      }

      onSuccess(savedUser);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setApiError(message);
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------------

  const inputClass = (hasError: boolean) =>
    [
      'block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset',
      'placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
      hasError
        ? 'ring-red-300 focus:ring-red-500'
        : 'ring-gray-300 focus:ring-indigo-600',
    ].join(' ');

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="user-form-title" className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="space-y-4 px-6 py-5">
            {/* API error */}
            {apiError && (
              <div
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
              >
                {apiError}
              </div>
            )}

            {/* Username – only on create */}
            {!isEdit && (
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700"
                >
                  Username <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={handleChange}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  aria-invalid={Boolean(errors.username)}
                  className={`mt-1 ${inputClass(Boolean(errors.username))}`}
                />
                {errors.username && (
                  <p id="username-error" role="alert" className="mt-1 text-xs text-red-600">
                    {errors.username}
                  </p>
                )}
              </div>
            )}

            {/* Full name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700"
              >
                Full Name <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                value={form.fullName}
                onChange={handleChange}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                aria-invalid={Boolean(errors.fullName)}
                className={`mt-1 ${inputClass(Boolean(errors.fullName))}`}
              />
              {errors.fullName && (
                <p id="fullName-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={Boolean(errors.email)}
                className={`mt-1 ${inputClass(Boolean(errors.email))}`}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700"
              >
                Role <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                aria-describedby={errors.role ? 'role-error' : undefined}
                aria-invalid={Boolean(errors.role)}
                className={`mt-1 ${inputClass(Boolean(errors.role))}`}
              >
                <option value="admin">Admin</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="cashier">Cashier</option>
              </select>
              {errors.role && (
                <p id="role-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.role}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                {isEdit ? 'New Password' : 'Password'}{' '}
                {!isEdit && (
                  <span aria-hidden="true" className="text-red-500">*</span>
                )}
                {isEdit && (
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (leave blank to keep current)
                  </span>
                )}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isEdit ? 'new-password' : 'new-password'}
                value={form.password}
                onChange={handleChange}
                aria-describedby={errors.password ? 'password-error' : 'password-hint'}
                aria-invalid={Boolean(errors.password)}
                className={`mt-1 ${inputClass(Boolean(errors.password))}`}
              />
              {errors.password ? (
                <p id="password-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.password}
                </p>
              ) : (
                <p id="password-hint" className="mt-1 text-xs text-gray-400">
                  Min. 8 characters with uppercase, lowercase, and a number.
                </p>
              )}
            </div>

            {/* Confirm password */}
            {(!isEdit || form.password) && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirm Password{' '}
                  {!isEdit && (
                    <span aria-hidden="true" className="text-red-500">*</span>
                  )}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className={`mt-1 ${inputClass(Boolean(errors.confirmPassword))}`}
                />
                {errors.confirmPassword && (
                  <p
                    id="confirmPassword-error"
                    role="alert"
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {/* Active status – only on edit */}
            {isEdit && (
              <div className="flex items-center gap-3">
                <input
                  id="isActive"
                  name="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Account is active
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {saving && (
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
