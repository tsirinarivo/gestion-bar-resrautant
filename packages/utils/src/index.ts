import { format, formatDistance, parseISO, startOfDay, endOfDay, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, _currency = 'MGA', _locale = 'fr-FR'): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `Ar ${formatted}`
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1_000_000) return `Ar ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `Ar ${(amount / 1_000).toFixed(0)}k`
  return formatCurrency(amount)
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function formatDate(date: Date | string, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: fr })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr })
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm')
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistance(d, new Date(), { addSuffix: true, locale: fr })
}

export function getDateRange(period: 'today' | 'week' | 'month' | 'year'): {
  from: Date
  to: Date
} {
  const now = new Date()
  const to = endOfDay(now)

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to }
    case 'week':
      return { from: startOfDay(subDays(now, 7)), to }
    case 'month':
      return { from: startOfDay(subDays(now, 30)), to }
    case 'year':
      return { from: startOfDay(subDays(now, 365)), to }
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

let orderCounter = 1000

export function generateOrderNumber(prefix = 'CMD'): string {
  const now = new Date()
  const dateStr = format(now, 'yyyyMMdd')
  const counter = String(++orderCounter).padStart(4, '0')
  return `${prefix}-${dateStr}-${counter}`
}

export function generateReservationRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'RES-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateCouponCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ─── Tax ──────────────────────────────────────────────────────────────────────

export function calculateTax(amountHT: number, taxRate: number): number {
  return amountHT * (taxRate / 100)
}

export function calculateTTC(amountHT: number, taxRate: number): number {
  return amountHT * (1 + taxRate / 100)
}

export function extractHT(amountTTC: number, taxRate: number): number {
  return amountTTC / (1 + taxRate / 100)
}

export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const conversions: Record<string, number> = {
    kg: 1000,
    g: 1,
    L: 1000,
    cl: 10,
    ml: 1,
  }

  const from = conversions[fromUnit]
  const to = conversions[toUnit]

  if (!from || !to) return null
  return (quantity * from) / to
}

export function formatQuantity(quantity: number, unit: string): string {
  if (quantity >= 1000 && unit === 'g') return `${(quantity / 1000).toFixed(2)} kg`
  if (quantity >= 100 && unit === 'cl') return `${(quantity / 100).toFixed(2)} L`
  return `${quantity.toFixed(2)} ${unit}`
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────

export function calculateLoyaltyPoints(orderAmount: number, pointsPerEuro = 1): number {
  return Math.floor(orderAmount * pointsPerEuro)
}

export function getLoyaltyTier(totalPoints: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (totalPoints >= 10000) return 'PLATINUM'
  if (totalPoints >= 5000) return 'GOLD'
  if (totalPoints >= 1000) return 'SILVER'
  return 'BRONZE'
}

export const LOYALTY_TIERS = {
  BRONZE: { min: 0, max: 999, color: '#CD7F32', label: 'Bronze' },
  SILVER: { min: 1000, max: 4999, color: '#C0C0C0', label: 'Argent' },
  GOLD: { min: 5000, max: 9999, color: '#FFD700', label: 'Or' },
  PLATINUM: { min: 10000, max: Infinity, color: '#E5E4E2', label: 'Platine' },
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

export function calculateMargin(sellPrice: number, costPrice: number): number {
  if (sellPrice === 0) return 0
  return ((sellPrice - costPrice) / sellPrice) * 100
}

export function calculateMarkup(sellPrice: number, costPrice: number): number {
  if (costPrice === 0) return 0
  return ((sellPrice - costPrice) / costPrice) * 100
}

export function suggestPrice(costPrice: number, targetMargin = 70): number {
  return costPrice / (1 - targetMargin / 100)
}

// ─── Strings ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - suffix.length) + suffix
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName.toUpperCase()}`
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// ─── Allergens ────────────────────────────────────────────────────────────────

export const ALLERGENS = [
  { code: 'gluten', label: 'Gluten', icon: '🌾' },
  { code: 'crustaces', label: 'Crustacés', icon: '🦐' },
  { code: 'oeufs', label: 'Œufs', icon: '🥚' },
  { code: 'poissons', label: 'Poissons', icon: '🐟' },
  { code: 'arachides', label: 'Arachides', icon: '🥜' },
  { code: 'soja', label: 'Soja', icon: '🫘' },
  { code: 'lait', label: 'Lait', icon: '🥛' },
  { code: 'fruits_a_coque', label: 'Fruits à coque', icon: '🌰' },
  { code: 'celeri', label: 'Céleri', icon: '🥬' },
  { code: 'moutarde', label: 'Moutarde', icon: '🌿' },
  { code: 'sesame', label: 'Sésame', icon: '🌱' },
  { code: 'sulfites', label: 'Sulfites', icon: '🍷' },
  { code: 'lupin', label: 'Lupin', icon: '🌸' },
  { code: 'mollusques', label: 'Mollusques', icon: '🦑' },
]

// ─── Colors ───────────────────────────────────────────────────────────────────

export const STATUS_COLORS = {
  // Order statuses
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  PREPARING: '#8B5CF6',
  READY: '#10B981',
  DELIVERED: '#10B981',
  COMPLETED: '#6B7280',
  CANCELLED: '#EF4444',

  // Table statuses
  AVAILABLE: '#10B981',
  OCCUPIED: '#EF4444',
  RESERVED: '#3B82F6',
  CLEANING: '#F59E0B',
  BLOCKED: '#6B7280',
}

export const CATEGORY_COLORS = [
  '#FF4D00', '#FFB800', '#10B981', '#3B82F6',
  '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4',
]

// ─── Validation ───────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPhone(phone: string): boolean {
  return /^(\+33|0)[1-9](\d{8})$/.test(phone.replace(/\s/g, ''))
}

export function isValidSiret(siret: string): boolean {
  return /^\d{14}$/.test(siret.replace(/\s/g, ''))
}

// ─── Number formatting ────────────────────────────────────────────────────────

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}
