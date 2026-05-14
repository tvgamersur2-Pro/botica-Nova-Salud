/**
 * ExpirationBadge Component
 *
 * Badge reutilizable que muestra el estado de vencimiento de un producto:
 *  - Rojo    → Vencido (fecha ya pasó)
 *  - Rojo    → Vence Pronto urgente (≤ 30 días)
 *  - Naranja → Vence Pronto (≤ 90 días)
 *  - Sin badge → Más de 90 días (solo muestra la fecha)
 *
 * Siempre muestra la fecha formateada en español.
 *
 * Requirements: FR-1.5, FR-5.1
 */

import React from 'react';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

export interface ExpirationBadgeProps {
  /** Fecha de vencimiento en formato ISO (YYYY-MM-DD o ISO 8601) */
  expirationDate: string;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

type ExpirationStatus = 'expired' | 'urgent' | 'soon' | 'ok';

function getExpirationStatus(expirationDate: string): ExpirationStatus {
  const exp = new Date(expirationDate);
  const now = new Date();

  // Normalizar a inicio del día para comparaciones de fecha
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);

  const diffMs   = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'urgent';
  if (diffDays <= 90) return 'soon';
  return 'ok';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

// ----------------------------------------------------------------
// Badge config per status
// ----------------------------------------------------------------

interface BadgeConfig {
  label: string;
  className: string;
  ariaLabel: string;
}

function getBadgeConfig(status: ExpirationStatus, formattedDate: string): BadgeConfig | null {
  switch (status) {
    case 'expired':
      return {
        label:     'Vencido',
        className: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/20',
        ariaLabel: `Producto vencido el ${formattedDate}`,
      };
    case 'urgent':
      return {
        label:     'Vence Pronto (urgente)',
        className: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/20',
        ariaLabel: `Vence pronto de forma urgente: ${formattedDate}`,
      };
    case 'soon':
      return {
        label:     'Vence Pronto',
        className: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-600/20',
        ariaLabel: `Vence pronto: ${formattedDate}`,
      };
    case 'ok':
    default:
      return null;
  }
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ExpirationBadge({ expirationDate }: ExpirationBadgeProps) {
  const status        = getExpirationStatus(expirationDate);
  const formattedDate = formatDate(expirationDate);
  const badgeConfig   = getBadgeConfig(status, formattedDate);

  return (
    <div className="flex flex-col gap-1">
      {/* Fecha siempre visible */}
      <span
        className={`text-sm ${
          status === 'expired'
            ? 'font-semibold text-red-600'
            : status === 'urgent'
            ? 'font-semibold text-red-500'
            : status === 'soon'
            ? 'font-medium text-orange-600'
            : 'text-gray-900'
        }`}
        aria-label={`Fecha de vencimiento: ${formattedDate}`}
      >
        {formattedDate}
      </span>

      {/* Badge condicional */}
      {badgeConfig && (
        <span
          aria-label={badgeConfig.ariaLabel}
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeConfig.className}`}
        >
          {badgeConfig.label}
        </span>
      )}
    </div>
  );
}
