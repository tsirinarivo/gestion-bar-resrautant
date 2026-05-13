import * as React from 'react';
import { Badge } from './Badge';

const ORDER_STATUS_MAP: Record<string, { label: string; variant: 'warning' | 'info' | 'purple' | 'success' | 'default' | 'danger' }> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  CONFIRMED: { label: 'Confirmée', variant: 'info' },
  PREPARING: { label: 'En préparation', variant: 'purple' },
  READY: { label: 'Prête', variant: 'success' },
  SERVED: { label: 'Servie', variant: 'success' },
  COMPLETED: { label: 'Terminée', variant: 'default' },
  CANCELLED: { label: 'Annulée', variant: 'danger' },
  DELIVERED: { label: 'Livrée', variant: 'success' },
};

const TABLE_STATUS_MAP: Record<string, { label: string; variant: 'success' | 'danger' | 'info' | 'warning' | 'default' }> = {
  AVAILABLE: { label: 'Libre', variant: 'success' },
  OCCUPIED: { label: 'Occupée', variant: 'danger' },
  RESERVED: { label: 'Réservée', variant: 'info' },
  CLEANING: { label: 'Nettoyage', variant: 'warning' },
  BLOCKED: { label: 'Bloquée', variant: 'default' },
};

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'table' | 'payment' | 'reservation';
  className?: string;
}

export function StatusBadge({ status, type = 'order', className }: StatusBadgeProps) {
  const map = type === 'table' ? TABLE_STATUS_MAP : ORDER_STATUS_MAP;
  const config = map[status] ?? { label: status, variant: 'default' as const };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
