/**
 * StockBadge Component
 *
 * Badge reutilizable que muestra el nivel de stock de un producto con
 * codificación de color:
 *  - Rojo   → Sin Stock (quantity === 0)
 *  - Amarillo → Stock Bajo (quantity <= threshold)
 *  - Verde  → En Stock (quantity > threshold)
 *
 * Muestra el número de unidades disponibles junto al estado.
 *
 * Requirements: FR-1.6, FR-5.1
 */

import React from 'react';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

export interface StockBadgeProps {
  /** Cantidad actual en inventario */
  quantityInStock: number;
  /** Umbral mínimo de stock configurado para el producto */
  minStockThreshold: number;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

type Variant = 'green' | 'yellow' | 'red';

interface BadgeConfig {
  label: string;
  variant: Variant;
  ariaLabel: string;
}

function getBadgeConfig(quantity: number, threshold: number): BadgeConfig {
  if (quantity === 0) {
    return {
      label: 'Sin Stock',
      variant: 'red',
      ariaLabel: 'Sin Stock: 0 unidades disponibles',
    };
  }
  if (quantity <= threshold) {
    return {
      label: 'Stock Bajo',
      variant: 'yellow',
      ariaLabel: `Stock Bajo: ${quantity} unidades disponibles`,
    };
  }
  return {
    label: 'En Stock',
    variant: 'green',
    ariaLabel: `En Stock: ${quantity} unidades disponibles`,
  };
}

const variantClasses: Record<Variant, string> = {
  green:  'bg-green-100 text-green-800 ring-green-600/20',
  yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  red:    'bg-red-100 text-red-800 ring-red-600/20',
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function StockBadge({ quantityInStock, minStockThreshold }: StockBadgeProps) {
  const { label, variant, ariaLabel } = getBadgeConfig(quantityInStock, minStockThreshold);

  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${variantClasses[variant]}`}
    >
      {/* Dot indicator */}
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          variant === 'green'
            ? 'bg-green-500'
            : variant === 'yellow'
            ? 'bg-yellow-500'
            : 'bg-red-500'
        }`}
      />
      {label}
      {quantityInStock > 0 && (
        <span className="font-normal opacity-75">({quantityInStock})</span>
      )}
    </span>
  );
}
