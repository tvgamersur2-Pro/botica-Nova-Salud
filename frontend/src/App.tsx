import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import {
  BeakerIcon,
  BuildingStorefrontIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  BellAlertIcon,
  ChartBarIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  ArrowLeftEndOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  SignalIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { authApi, tokenStorage } from './services/api';
import type { AuthenticatedUser, UserRole } from './types/user';

import ProductList from './components/products/ProductList';
import ProductForm from './components/products/ProductForm';
import UserList from './components/users/UserList';
import UserForm from './components/users/UserForm';
import SalesCart from './components/sales/SalesCart';
import TransactionHistory from './components/sales/TransactionHistory';
import AlertDashboard from './components/alerts/AlertDashboard';
import ReportsDashboard from './components/reports/ReportsDashboard';
import AuditLogViewer from './components/admin/AuditLogViewer';
import SupplierList from './components/inventory/SupplierList';
import SupplierForm from './components/inventory/SupplierForm';

// ----------------------------------------------------------------
// Auth context
// ----------------------------------------------------------------

interface AuthContextValue {
  user: AuthenticatedUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ----------------------------------------------------------------
// Nav items config
// ----------------------------------------------------------------

const NAV_ITEMS = [
  { to: '/products',     label: 'Productos',    Icon: BeakerIcon,                  roles: ['admin','pharmacist','cashier'] },
  { to: '/suppliers',    label: 'Proveedores',  Icon: BuildingStorefrontIcon,       roles: ['admin','pharmacist','cashier'] },
  { to: '/sales',        label: 'Nueva Venta',  Icon: ShoppingCartIcon,             roles: ['admin','pharmacist','cashier'] },
  { to: '/transactions', label: 'Historial',    Icon: ClipboardDocumentListIcon,    roles: ['admin','pharmacist','cashier'] },
  { to: '/alerts',       label: 'Alertas',      Icon: BellAlertIcon,                roles: ['admin','pharmacist','cashier'] },
  { to: '/reports',      label: 'Reportes',     Icon: ChartBarIcon,                 roles: ['admin','pharmacist','cashier'] },
  { to: '/users',        label: 'Usuarios',     Icon: UsersIcon,                    roles: ['admin'] },
  { to: '/audit',        label: 'Auditoría',    Icon: MagnifyingGlassIcon,          roles: ['admin'] },
] as const;

// ----------------------------------------------------------------
// Login page
// ----------------------------------------------------------------

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/products');
    } catch {
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-purple-500 opacity-10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-400 opacity-10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <BeakerIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Nova Salud</h1>
          <p className="text-indigo-300 mt-1 text-sm">Sistema de Gestión Farmacéutica</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar sesión</h2>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all sm:text-sm"
                placeholder="Ingresa tu usuario"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Ingresando…
                </span>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Layout with sidebar
// ----------------------------------------------------------------

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel: Record<UserRole, string> = {
    admin: 'Administrador',
    pharmacist: 'Farmacéutico',
    cashier: 'Cajero',
  };

  const roleColor: Record<UserRole, string> = {
    admin: 'bg-purple-500/20 text-purple-200',
    pharmacist: 'bg-blue-500/20 text-blue-200',
    cashier: 'bg-green-500/20 text-green-200',
  };

  const visibleNav = NAV_ITEMS.filter(item =>
    user && (item.roles as readonly string[]).includes(user.role)
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-gradient-to-b from-indigo-900 to-indigo-950 transition-all duration-300 ${sidebarOpen ? 'w-60' : 'w-16'}`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <BeakerIcon className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate">Nova Salud</p>
              <p className="text-indigo-400 text-xs truncate">Farmacia</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className={`${sidebarOpen ? '' : 'mx-auto'} text-indigo-400 hover:text-white transition-colors flex-shrink-0`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen
              ? <ChevronDoubleLeftIcon className="w-4 h-4" />
              : <ChevronDoubleRightIcon className="w-4 h-4" />
            }
          </button>
        </div>

        {/* User info */}
        {sidebarOpen && user && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.username}</p>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[user.role]}`}>
                  {roleLabel[user.role]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={!sidebarOpen ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-indigo-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.Icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-4 border-t border-white/10 pt-3">
          <button
            onClick={handleLogout}
            title={!sidebarOpen ? 'Cerrar sesión' : undefined}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-indigo-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <ArrowLeftEndOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CalendarDaysIcon className="w-4 h-4" />
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <SignalIcon className="w-4 h-4 text-green-500" />
            Sistema en línea
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Protected route
// ----------------------------------------------------------------

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/products" replace />;
  return <>{children}</>;
}

// ----------------------------------------------------------------
// Products page
// ----------------------------------------------------------------

function ProductsPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Parameters<typeof ProductForm>[0]['product']>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    setShowForm(false);
    setEditProduct(undefined);
    setRefreshKey(k => k + 1);
  };

  return (
    <>
      <ProductList
        userRole={user?.role}
        refreshKey={refreshKey}
        onAddProduct={() => setShowForm(true)}
        onEditProduct={p => { setEditProduct(p); setShowForm(true); }}
      />
      {showForm && (
        <ProductForm
          product={editProduct}
          onSuccess={handleSaved}
          onCancel={() => { setShowForm(false); setEditProduct(undefined); }}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------
// Users page
// ----------------------------------------------------------------

function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<Parameters<typeof UserForm>[0]['user']>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    setShowForm(false);
    setEditUser(undefined);
    setRefreshKey(k => k + 1);
  };

  return (
    <>
      <UserList
        refreshKey={refreshKey}
        onAddUser={() => setShowForm(true)}
        onEditUser={u => { setEditUser(u); setShowForm(true); }}
      />
      {showForm && (
        <UserForm
          user={editUser}
          onSuccess={handleSaved}
          onCancel={() => { setShowForm(false); setEditUser(undefined); }}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------
// Suppliers page
// ----------------------------------------------------------------

function SuppliersPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Parameters<typeof SupplierForm>[0]['supplier']>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    setShowForm(false);
    setEditSupplier(undefined);
    setRefreshKey(k => k + 1);
  };

  return (
    <>
      <SupplierList
        userRole={user?.role}
        refreshKey={refreshKey}
        onAddSupplier={() => setShowForm(true)}
        onEditSupplier={s => { setEditSupplier(s); setShowForm(true); }}
      />
      {showForm && (
        <SupplierForm
          supplier={editSupplier}
          onSuccess={handleSaved}
          onCancel={() => { setShowForm(false); setEditSupplier(undefined); }}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------
// Root App
// ----------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return null;
    try {
      // Para tokens mock, extraer info del token base64
      const decoded = atob(token);
      if (decoded.includes(':')) {
        // Es un token mock, necesitamos obtener el usuario del localStorage
        const savedUser = localStorage.getItem('nova_salud_user');
        if (savedUser) {
          return JSON.parse(savedUser);
        }
      } else {
        // Es un JWT real
        const payload = JSON.parse(atob(token.split('.')[1]));
        return { userId: payload.userId, username: payload.username, role: payload.role };
      }
    } catch {
      return null;
    }
    return null;
  });

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
    const u = res.data.user;
    const authUser = { userId: u.id, username: u.username, role: u.role };
    setUser(authUser);
    // Guardar usuario en localStorage para persistencia
    localStorage.setItem('nova_salud_user', JSON.stringify(authUser));
  };

  const logout = () => {
    const refresh = tokenStorage.getRefreshToken();
    if (refresh) authApi.logout(refresh).catch(() => {});
    tokenStorage.clearTokens();
    localStorage.removeItem('nova_salud_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/products" replace />} />

          <Route path="/products" element={
            <ProtectedRoute><Layout><ProductsPage /></Layout></ProtectedRoute>
          } />
          <Route path="/suppliers" element={
            <ProtectedRoute><Layout><SuppliersPage /></Layout></ProtectedRoute>
          } />
          <Route path="/sales" element={
            <ProtectedRoute><Layout><SalesCart onTransactionComplete={() => {}} /></Layout></ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute><Layout><TransactionHistory userRole={user?.role ?? 'cashier'} /></Layout></ProtectedRoute>
          } />
          <Route path="/alerts" element={
            <ProtectedRoute><Layout><AlertDashboard userRole={user?.role ?? 'cashier'} /></Layout></ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute><Layout><ReportsDashboard userRole={user?.role ?? 'cashier'} /></Layout></ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute roles={['admin']}><Layout><UsersPage /></Layout></ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute roles={['admin']}><Layout><AuditLogViewer /></Layout></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/products" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
