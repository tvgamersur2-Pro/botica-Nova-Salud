/**
 * UserList Component
 *
 * Displays a paginated, filterable list of users.
 * Only accessible to Admin role.
 *
 * Requirements: FR-5.1, FR-5.3, FR-5.7
 */

import React, { useCallback, useEffect, useState } from 'react';
import { usersApi } from '../../services/api';
import type { User, UserFilters, UserRole } from '../../types/user';

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

interface BadgeProps {
  label: string;
  variant: 'green' | 'red' | 'blue' | 'yellow' | 'gray';
}

function Badge({ label, variant }: BadgeProps) {
  const classes: Record<BadgeProps['variant'], string> = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-800',
    blue:   'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray:   'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant]}`}
    >
      {label}
    </span>
  );
}

function roleBadge(role: UserRole) {
  const map: Record<UserRole, { label: string; variant: BadgeProps['variant'] }> = {
    admin:       { label: 'Admin',       variant: 'blue'   },
    pharmacist:  { label: 'Pharmacist',  variant: 'yellow' },
    cashier:     { label: 'Cashier',     variant: 'gray'   },
  };
  const { label, variant } = map[role] ?? { label: role, variant: 'gray' };
  return <Badge label={label} variant={variant} />;
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface UserListProps {
  /** Called when the user clicks "Add User" */
  onAddUser: () => void;
  /** Called when the user clicks "Edit" on a row */
  onEditUser: (user: User) => void;
  /** Refresh trigger – increment to force a reload */
  refreshKey?: number;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function UserList({ onAddUser, onEditUser, refreshKey = 0 }: UserListProps) {
  const [users, setUsers]         = useState<User[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [filters, setFilters] = useState<UserFilters>({
    search:   '',
    role:     '',
    isActive: '',
    page:     1,
    limit:    20,
  });

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.list(filters);
      setUsers(result.data);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load users. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ----------------------------------------------------------------
  // Deactivate handler
  // ----------------------------------------------------------------

  const handleDeactivate = async (user: User) => {
    if (
      !window.confirm(
        `Are you sure you want to deactivate "${user.fullName}"? They will no longer be able to log in.`,
      )
    ) {
      return;
    }
    try {
      await usersApi.deactivate(user.id);
      void fetchUsers();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to deactivate user.';
      alert(message);
    }
  };

  // ----------------------------------------------------------------
  // Filter helpers
  // ----------------------------------------------------------------

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, role: e.target.value as UserRole | '', page: 1 }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilters((prev) => ({
      ...prev,
      isActive: val === '' ? '' : val === 'true',
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} user{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          type="button"
          onClick={onAddUser}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg bg-gray-50 p-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-4 w-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="user-search"
              type="search"
              placeholder="Search by name, username, or email…"
              value={filters.search ?? ''}
              onChange={handleSearchChange}
              className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        {/* Role filter */}
        <div>
          <label htmlFor="role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="role-filter"
            value={filters.role ?? ''}
            onChange={handleRoleChange}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="cashier">Cashier</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={filters.isActive === '' ? '' : String(filters.isActive)}
            onChange={handleStatusChange}
            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-8" aria-label="Loading users">
          <svg
            className="h-8 w-8 animate-spin text-indigo-600"
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
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  User
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Role
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Last Login
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar placeholder */}
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
                          aria-hidden="true"
                        >
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.fullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            @{user.username} · {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {roleBadge(user.role)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge
                        label={user.isActive ? 'Active' : 'Inactive'}
                        variant={user.isActive ? 'green' : 'red'}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => onEditUser(user)}
                          className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Edit
                        </button>
                        {user.isActive && (
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(user)}
                            className="font-medium text-red-600 hover:text-red-500"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{filters.page}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => handlePageChange((filters.page ?? 1) - 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => handlePageChange((filters.page ?? 1) + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
