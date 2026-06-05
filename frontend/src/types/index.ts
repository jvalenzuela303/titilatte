// ─── Roles ────────────────────────────────────────────────────────────────────

export type RoleName = 'ADMIN' | 'CAJERO' | 'BODEGA' | 'SUPERVISOR'

export interface Role {
  id: string
  name: RoleName
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: Role[]
}

// ─── Product Category ─────────────────────────────────────────────────────────

export interface ProductFamily {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
}

export interface ProductCategory {
  id: string
  familyId: string
  familyName: string
  code: string
  name: string
  description: string | null
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateCategoryRequest {
  code: string
  name: string
  description?: string
  familyId: string
  active: boolean
}

export interface UpdateCategoryRequest {
  code?: string
  name?: string
  description?: string
  familyId?: string
  active?: boolean
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductCategory2 {
  id: string
  code: string
  name: string
}

export interface ProductTax {
  id: string
  code: string
  name: string
  rate: number
}

export interface ProductUnit {
  id: string
  code: string
  name: string
  abbreviation: string
}

export interface Product {
  id: string
  barcode: string
  name: string
  description: string | null
  purchasePrice: number
  salePrice: number
  stockCurrent: number
  stockMinimum: number
  stockMaximum: number | null
  active: boolean
  trackStock: boolean
  category: ProductCategory2
  tax: ProductTax
  unit: ProductUnit
  createdAt: string
  updatedAt: string
}

export type StockStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OVERSTOCK' | 'NO_TRACK'

export interface StockEntry extends Product {
  status: StockStatus
}

export interface CreateProductRequest {
  barcode: string
  name: string
  description?: string
  purchasePrice: number
  salePrice: number
  stockMinimum: number
  stockMaximum: number
  categoryId: string
  taxId: string
  unitId: string
  trackStock: boolean
}

export interface UpdateProductRequest {
  barcode?: string
  name?: string
  description?: string
  purchasePrice?: number
  salePrice?: number
  stockMinimum?: number
  stockMaximum?: number
  categoryId?: string
  taxId?: string
  unitId?: string
  isActive?: boolean
  trackStock?: boolean
}

// ─── Sale ─────────────────────────────────────────────────────────────────────

export type SaleType = 'CONTADO' | 'CREDITO' | 'MIXTO'
export type SaleStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'

export interface SaleDetail {
  id: string
  productId: string
  productName: string
  productBarcode: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
  taxRate: number
  taxAmount: number
}

export interface Payment {
  id: string
  method: PaymentMethod
  amount: number
  changeAmount: number
  reference: string | null
}

export interface SaleSeller {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface Sale {
  id: string
  saleNumber: number
  type: SaleType
  status: SaleStatus
  totalAmount: number
  discountAmount: number
  taxAmount: number
  netAmount: number
  seller: SaleSeller
  customerId: string | null
  notes: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  details: SaleDetail[]
  payments: Payment[]
  createdAt: string
  updatedAt: string
}

export interface SaleItemRequest {
  productId: string
  quantity: number
  discount?: number
}

export interface CreateSaleRequest {
  type: SaleType
  items: SaleItemRequest[]
  paymentMethod: PaymentMethod
  paymentAmount: number
  changeAmount?: number
  paymentReference?: string
  customerId?: string
  notes?: string
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export type StockMovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA' | 'DEVOLUCION' | string

export interface StockMovementUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface StockMovementProduct {
  id: string
  barcode: string
  name: string
  stockCurrent: number
}

export interface StockMovement {
  id: string
  product: StockMovementProduct
  movementType: StockMovementType
  quantity: number
  quantityBefore: number
  quantityAfter: number
  notes: string | null
  createdBy: StockMovementUser
  authorizedBy: StockMovementUser | null
  createdAt: string
}

export interface StockAdjustmentRequest {
  productId: string
  movementType: 'AJUSTE' | 'COMPRA' | 'MERMA'
  quantity: number
  notes: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first?: boolean
  last?: boolean
  empty?: boolean
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  userId: string
  email: string
  firstName: string
  lastName: string
  roles: RoleName[]
  branchId: string | null
}

// ─── Cart (frontend only) ─────────────────────────────────────────────────────

export interface CartItem {
  product: Product
  quantity: number
  unitPrice: number
  subtotal: number
}

// ─── Fase 2: Purchases ────────────────────────────────────────────
export interface Supplier {
  id: string
  name: string
  rut?: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  active: boolean
}

export interface PurchaseItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitCost: number
  subtotal: number
  previousCost?: number
  newAvgCost?: number
}

export interface Purchase {
  id: string
  purchaseNumber: number
  supplierName?: string
  documentType: 'FACTURA' | 'BOLETA' | 'SIN_DOCUMENTO'
  documentNumber?: string
  totalAmount: number
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
  notes?: string
  purchasedByEmail: string
  purchaseDate: string
  createdAt: string
  items: PurchaseItem[]
}

export interface CreatePurchaseRequest {
  supplierId?: string
  documentType: 'FACTURA' | 'BOLETA' | 'SIN_DOCUMENTO'
  documentNumber?: string
  items: { productId: string; quantity: number; unitCost: number }[]
  notes?: string
  purchaseDate: string
}

// ─── Fase 2: Cash ─────────────────────────────────────────────────
export interface CashRegister {
  id: string
  registerNumber: number
  cashierName: string
  openingAmount: number
  expectedClosingAmount?: number
  countedAmount?: number
  differenceAmount?: number
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt?: string
  notes?: string
}

export interface CashSummary {
  registerNumber: number
  cashierName: string
  openingAmount: number
  totalSales: number
  totalIncome: number
  totalExpense: number
  expectedAmount: number
  countedAmount?: number
  difference?: number
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt?: string
}

export interface CashMovement {
  id: string
  movementType: 'INGRESO' | 'EGRESO' | 'VENTA' | 'PAGO_CREDITO'
  category: string
  amount: number
  description: string
  createdAt: string
}

// ─── Fase 2: Customers ────────────────────────────────────────────
export interface Customer {
  id: string
  firstName: string
  lastName: string
  fullName: string
  rut?: string
  phone?: string
  email?: string
  creditLimit: number
  creditUsed: number
  availableCredit: number
  active: boolean
  createdAt: string
}

export interface CustomerDebt {
  customerId: string
  fullName: string
  rut?: string
  creditLimit: number
  creditUsed: number
  available: number
  lastPaymentDate?: string
}

// ─── Fase 2: Reports ──────────────────────────────────────────────
export interface DailySales {
  date: string
  saleCount: number
  totalAmount: number
}

export interface SalesReport {
  totalSales: number
  totalAmount: number
  totalDiscount: number
  dailyBreakdown: DailySales[]
}

export interface TopProduct {
  rank: number
  productId: string
  productName: string
  totalQuantity: number
  totalAmount: number
}

export interface ProfitReport {
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
}

export interface SellerReport {
  sellerId: string
  sellerEmail: string
  saleCount: number
  totalAmount: number
}

// ─── Fase 3: SSE ──────────────────────────────────────────────────
export type SseEventType =
  | 'VENTA_CONFIRMADA'
  | 'STOCK_CRITICO'
  | 'CAJA_ABIERTA'
  | 'CAJA_CERRADA'
  | 'HEARTBEAT'
  | 'CONNECTED'

export interface SseEvent {
  type: SseEventType
  data: Record<string, unknown>
  timestamp: string
}

// ─── Fase 3: Dashboard ────────────────────────────────────────────
export interface AdminDashboard {
  dashboardType: 'ADMIN'
  salesToday: number
  saleCountToday: number
  profitToday: number
  profitMarginToday: number
  lowStockCount: number
  debtorCount: number
  totalDebt: number
  last7Days: DailySales[]
  last30Days: DailySales[]
}

export interface SupervisorDashboard {
  dashboardType: 'SUPERVISOR'
  openCashRegisters: CashSummary[]
  sellerStatsToday: SellerReport[]
  lowStockCount: number
  salesToday: number
  saleCountToday: number
}

export interface CashierDashboard {
  dashboardType: 'CASHIER'
  currentCash: CashSummary | null
  myTotalSalesToday: number
  mySaleCountToday: number
  myTotalCash: number
}

export type DashboardData = AdminDashboard | SupervisorDashboard | CashierDashboard

// ─── Fase 3: Audit ────────────────────────────────────────────────
export interface AuditLog {
  id: string
  entityType: string
  entityId: string | null
  action: string
  oldValue: string | null
  newValue: string | null
  reason: string | null
  performedByEmail: string
  ipAddress: string | null
  createdAt: string
}

// ─── Promotions ───────────────────────────────────────────────────────────────
export type PromotionType = 'PERCENTAGE' | 'FIXED_PRICE' | 'TWO_FOR_ONE' | 'QUANTITY_DISCOUNT'
export type PromotionAppliesTo = 'SPECIFIC_PRODUCTS' | 'ALL_PRODUCTS' | 'CATEGORY'

export interface Promotion {
  id: string
  name: string
  description: string | null
  type: PromotionType
  value: number | null
  minQuantity: number
  bonusQuantity: number | null
  appliesTo: PromotionAppliesTo
  categoryId: string | null
  categoryName: string | null
  startsAt: string
  endsAt: string
  active: boolean
  branchId: string | null
  productIds: string[]
  createdAt: string
}

export interface AppliedPromotion {
  promotionId: string
  promotionName: string
  type: PromotionType
  originalPrice: number
  finalPrice: number
  discountAmount: number
  discountPercent: number
  effectiveQuantity: number
  bonusQuantity: number
  description: string
}

export interface CreatePromotionRequest {
  name: string
  description?: string
  type: PromotionType
  value?: number
  minQuantity: number
  bonusQuantity?: number
  appliesTo: PromotionAppliesTo
  categoryId?: string
  startsAt: string
  endsAt: string
  active: boolean
  branchId?: string
  productIds?: string[]
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export type AlertType = 'SALES_BELOW_THRESHOLD' | 'CASH_OPEN_TOO_LONG' | 'LOW_STOCK_COUNT' | 'HIGH_DEBT_TOTAL'
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface AlertRule {
  id: string
  name: string
  description: string | null
  type: AlertType
  thresholdValue: number | null
  thresholdMinutes: number | null
  checkIntervalMinutes: number
  recipientRole: string
  active: boolean
  lastCheckedAt: string | null
  lastTriggeredAt: string | null
  createdAt: string
}

export interface AlertHistory {
  id: string
  ruleId: string | null
  ruleName: string
  type: AlertType
  severity: AlertSeverity
  message: string
  triggeredAt: string
  acknowledged: boolean
  acknowledgedBy: string | null
  acknowledgedAt: string | null
}

export interface CreateAlertRuleRequest {
  name: string
  description?: string
  type: AlertType
  thresholdValue?: number
  thresholdMinutes?: number
  checkIntervalMinutes: number
  recipientRole: string
  active: boolean
}

// ─── Period Closes ────────────────────────────────────────────────────────────
export type PeriodCloseStatus = 'DRAFT' | 'CLOSED'

export interface PeriodClose {
  id: string
  periodYear: number
  periodMonth: number
  status: PeriodCloseStatus
  branchId: string | null
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMarginPct: number
  totalDiscountGiven: number
  saleCount: number
  totalCreditSales: number
  totalPaymentsReceived: number
  outstandingReceivables: number
  totalCashOpenings: number
  totalPurchaseAmount: number
  prevRevenue: number | null
  prevProfit: number | null
  revenueChangePct: number | null
  notes: string | null
  closedAt: string | null
  closedByEmail: string | null
  createdAt: string
}

export interface MonthlyComparison {
  year: number
  month: number
  periodLabel: string
  totalRevenue: number
  totalProfit: number
  profitMarginPct: number
  saleCount: number
  isClosed: boolean
}

export interface CreatePeriodCloseRequest {
  year: number
  month: number
  branchId?: string
  notes?: string
}
