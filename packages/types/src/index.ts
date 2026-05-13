// ─── Core Types ───────────────────────────────────────────────────────────────

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE'
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'CARD' | 'STRIPE' | 'PAYPAL' | 'VOUCHER' | 'WALLET'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUND'
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'BLOCKED'
export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'LOSS' | 'TRANSFER'
export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

// ─── Restaurant ───────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string
  name: string
  slug: string
  description?: string
  logo?: string
  banner?: string
  address: string
  city: string
  postalCode: string
  country: string
  phone: string
  email: string
  siret?: string
  website?: string
  timezone: string
  currency: string
  vatNumber?: string
  openingHours?: OpeningHours
  defaultTaxRate: number
  deliveryEnabled: boolean
  pickupEnabled: boolean
  dineInEnabled: boolean
  minOrderAmount: number
  deliveryRadius?: number
  deliveryFee: number
  estimatedPrepTime: number
  stripeAccountId?: string
  createdAt: Date
  updatedAt: Date
}

export interface OpeningHours {
  monday?: DayHours
  tuesday?: DayHours
  wednesday?: DayHours
  thursday?: DayHours
  friday?: DayHours
  saturday?: DayHours
  sunday?: DayHours
}

export interface DayHours {
  isOpen: boolean
  open?: string // HH:mm
  close?: string
  breakStart?: string
  breakEnd?: string
}

// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'manager' | 'caissier' | 'serveur' | 'cuisinier' | 'client'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  phone?: string
  isActive: boolean
  isVerified: boolean
  lastLoginAt?: Date
  restaurantId: string
  roleId: string
  role?: Role
  createdAt: Date
  updatedAt: Date
}

export interface Role {
  id: string
  name: string
  displayName: string
  description?: string
  isSystem: boolean
  permissions?: Permission[]
}

export interface Permission {
  id: string
  resource: string
  action: string
  description?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  image?: string
  sortOrder: number
  isActive: boolean
  isAvailable: boolean
  restaurantId: string
  parentId?: string
  products?: Product[]
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string
  shortDesc?: string
  sku?: string
  price: number
  comparePrice?: number
  costPrice?: number
  taxRate: number
  image?: string
  images: string[]
  isActive: boolean
  isAvailable: boolean
  isFeatured: boolean
  isNew: boolean
  sortOrder: number
  calories?: number
  proteins?: number
  carbs?: number
  fats?: number
  allergens: string[]
  tags: string[]
  prepTime: number
  restaurantId: string
  categoryId: string
  category?: Category
  variants?: ProductVariant[]
  modifierGroups?: ModifierGroup[]
  createdAt: Date
  updatedAt: Date
}

export interface ProductVariant {
  id: string
  name: string
  sku?: string
  price: number
  costPrice?: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  productId: string
}

export interface ModifierGroup {
  id: string
  name: string
  description?: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  sortOrder: number
  modifiers: Modifier[]
}

export interface Modifier {
  id: string
  name: string
  price: number
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  groupId: string
}

// ─── Ingredients & Recipe ─────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  name: string
  description?: string
  unit: string
  costPerUnit: number
  allergens: string[]
  stockItemId?: string
  createdAt: Date
  updatedAt: Date
}

export interface RecipeItem {
  id: string
  quantity: number
  unit: string
  yieldRate: number
  notes?: string
  productId: string
  ingredientId: string
  ingredient?: Ingredient
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export interface StockItem {
  id: string
  name: string
  description?: string
  sku?: string
  unit: string
  currentQuantity: number
  minQuantity: number
  reorderQuantity: number
  maxQuantity?: number
  location?: string
  costPerUnit: number
  valuationMethod: string
  isPerishable: boolean
  expiryDate?: Date
  restaurantId: string
  supplierId?: string
  createdAt: Date
  updatedAt: Date
}

export interface StockMovement {
  id: string
  type: StockMovementType
  quantity: number
  unitCost?: number
  reason?: string
  notes?: string
  reference?: string
  stockItemId: string
  createdAt: Date
  createdBy?: string
}

// ─── Tables & Reservations ────────────────────────────────────────────────────

export interface DiningTable {
  id: string
  number: number
  name?: string
  capacity: number
  minCapacity: number
  shape: string
  width: number
  height: number
  posX: number
  posY: number
  rotation: number
  section?: string
  status: TableStatus
  isActive: boolean
  restaurantId: string
  currentOrder?: Order
  createdAt: Date
  updatedAt: Date
}

export interface Reservation {
  id: string
  reservationRef: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  partySize: number
  date: Date
  duration: number
  status: ReservationStatus
  notes?: string
  specialRequest?: string
  source: string
  restaurantId: string
  tableId?: string
  customerId?: string
  createdAt: Date
  updatedAt: Date
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus
  source: string
  subtotal: number
  taxAmount: number
  discountAmount: number
  deliveryFee: number
  tipAmount: number
  totalAmount: number
  deliveryAddress?: string
  deliveryCity?: string
  deliveryPostalCode?: string
  deliveryNotes?: string
  estimatedTime?: number
  notes?: string
  guestCount: number
  restaurantId: string
  tableId?: string
  customerId?: string
  couponId?: string
  items: OrderItem[]
  payments?: Payment[]
  table?: DiningTable
  customer?: Customer
  createdAt: Date
  updatedAt: Date
}

export interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  status: string
  kdsStation?: string
  preparedAt?: Date
  orderId: string
  productId: string
  product?: Product
  modifiers: OrderItemModifier[]
}

export interface OrderItemModifier {
  id: string
  name: string
  price: number
  type: string
  orderItemId: string
  modifierId?: string
  variantId?: string
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface Payment {
  id: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  reference?: string
  stripePaymentId?: string
  receiptUrl?: string
  notes?: string
  orderId: string
  createdAt: Date
  updatedAt: Date
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  email?: string
  phone?: string
  firstName: string
  lastName: string
  birthDate?: Date
  avatar?: string
  isActive: boolean
  address?: string
  city?: string
  postalCode?: string
  acceptsMarketing: boolean
  acceptsSms: boolean
  restaurantId: string
  loyaltyAccount?: LoyaltyAccount
  createdAt: Date
  updatedAt: Date
}

export interface LoyaltyAccount {
  id: string
  points: number
  totalEarned: number
  totalSpent: number
  tier: LoyaltyTier
  tierExpiry?: Date
  customerId: string
}

// ─── Employee ─────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  employeeCode?: string
  position: string
  department?: string
  hireDate?: Date
  salary?: number
  salaryType: string
  isActive: boolean
  userId: string
  user?: User
  restaurantId: string
  createdAt: Date
  updatedAt: Date
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface DashboardKPIs {
  revenue: {
    today: number
    yesterday: number
    thisWeek: number
    thisMonth: number
    trend: number // percentage change vs previous period
  }
  orders: {
    today: number
    pending: number
    inProgress: number
    completed: number
  }
  tables: {
    total: number
    occupied: number
    available: number
    reserved: number
    occupancyRate: number
  }
  averageTicket: number
  totalCovers: number
  topProducts: Array<{
    productId: string
    name: string
    quantity: number
    revenue: number
  }>
}

export interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
  covers: number
}

export interface HourlyData {
  hour: number
  orders: number
  revenue: number
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

// ─── Socket Events ────────────────────────────────────────────────────────────

export interface SocketEvents {
  // Order events
  'order:created': Order
  'order:updated': Order
  'order:status_changed': { orderId: string; status: OrderStatus; order: Order }
  'order:item_ready': { orderId: string; itemId: string }

  // Table events
  'table:status_changed': { tableId: string; status: TableStatus }
  'table:order_updated': { tableId: string; order: Order }

  // KDS events
  'kds:new_order': Order
  'kds:item_prepared': { orderId: string; itemId: string }

  // Stock events
  'stock:alert': { stockItemId: string; type: string; message: string }
  'stock:low': { itemName: string; currentQuantity: number; unit: string }

  // Notification events
  'notification:new': { id: string; title: string; message: string; type: string }
}
