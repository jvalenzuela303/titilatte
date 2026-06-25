import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Row,
  Col,
  Input,
  Button,
  Card,
  List,
  InputNumber,
  Typography,
  Divider,
  Select,
  Space,
  Tag,
  Empty,
  Spin,
  Modal,
  Alert,
  theme,
  Descriptions,
  App,
  Form,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
  PlusOutlined,
  LockOutlined,
  WalletOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import apiClient from '@/config/axios'
import { useCartStore } from '@/store/cartStore'
import promotionService from '@/services/promotionService'
import { cashService } from '@/services/cashService'
import { customerService } from '@/services/customerService'
import type { Product, Sale, SaleType, PaymentMethod, CreateSaleRequest, Promotion, Customer } from '@/types'
import '@/styles/print.css'
import ThermalReceipt from '@/components/ThermalReceipt'

const { Text, Title } = Typography

// ─── Barcode scanner detection ────────────────────────────────────────────────
// USB scanners send characters very fast then fire Enter.
// Heuristic: >= 3 chars arriving in < 100ms between keystrokes = barcode scan.
const SCAN_SPEED_MS = 100
const MIN_SCAN_LENGTH = 3

// ─── Weight-based products ────────────────────────────────────────────────────
// Products whose unit code belongs to this set are sold by weight and
// require the cashier to enter a decimal quantity instead of a whole number.
// NOTE: LT and ML are excluded — liquid products (beverages, etc.) are sold
// by unit/quantity, not weighed at the register.
const WEIGHT_UNIT_CODES = new Set(['KG', 'GR'])
const isByWeight = (product: Product) =>
  WEIGHT_UNIT_CODES.has(product.unit.code.toUpperCase())

// ─── Custom-price products ────────────────────────────────────────────────────
// Products with allowCustomPrice=true: the cashier enters the total amount
// to charge (not a weight or quantity). The price varies per transaction.
const isCustomPrice = (product: Product) => product.allowCustomPrice

/** Format a quantity for display: integers show without decimals, others trim trailing zeros */
const formatQty = (qty: number): string =>
  Number.isInteger(qty) ? String(qty) : parseFloat(qty.toFixed(3)).toString()

/**
 * Ley de redondeo chilena — redondea al múltiplo de $10 más cercano.
 * 0–4 → baja  (ej. $1.234 → $1.230)
 * 5–9 → sube  (ej. $1.235 → $1.240)
 */
const roundChilean = (amount: number): number => Math.round(amount / 10) * 10

const POSPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotal } = useCartStore()

  const [cashReady, setCashReady] = useState<boolean | null>(null)
  const total = getTotal()
  const roundedTotal = roundChilean(total)
  const rounding = roundedTotal - total   // negativo → baja, positivo → sube

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [saleType, setSaleType] = useState<SaleType>('CONTADO')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [amountReceived, setAmountReceived] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [ticketVisible, setTicketVisible] = useState(false)
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([])

  // Customer for credit sales
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)

  // Quick new customer modal
  const [newCustomerForm] = Form.useForm()
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false)
  const [newCustomerSubmitting, setNewCustomerSubmitting] = useState(false)

  const handleSaleTypeChange = (val: SaleType) => {
    setSaleType(val)
    if (val === 'CONTADO') {
      setSelectedCustomer(null)
      setCustomerOptions([])
    }
  }

  const handleNewCustomerSubmit = async () => {
    let values: Record<string, unknown>
    try {
      values = await newCustomerForm.validateFields()
    } catch {
      return
    }
    setNewCustomerSubmitting(true)
    try {
      const res = await customerService.create(values)
      const created = res.data
      setSelectedCustomer(created)
      setCustomerOptions([created])
      setNewCustomerModalOpen(false)
      newCustomerForm.resetFields()
      message.success(`Cliente "${created.fullName}" creado y seleccionado`)
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Error al crear el cliente'
      message.error(msg)
    } finally {
      setNewCustomerSubmitting(false)
    }
  }

  const handleCustomerSearch = async (value: string) => {
    if (!value.trim()) {
      setCustomerOptions([])
      return
    }
    setCustomerSearchLoading(true)
    try {
      const res = await customerService.getAll({ search: value, size: 10, active: true })
      setCustomerOptions(res.data.content ?? [])
    } catch {
      // silencioso
    } finally {
      setCustomerSearchLoading(false)
    }
  }

  // Weight modal state
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null)
  const [weightInput, setWeightInput] = useState<number | null>(null)

  // Custom price modal state
  const [customPriceModalProduct, setCustomPriceModalProduct] = useState<Product | null>(null)
  const [customPriceInput, setCustomPriceInput] = useState<number | null>(null)

  // Barcode scanner timing state
  const lastKeyTimeRef = useRef<number>(0)
  const barcodeBufferRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const change =
    paymentMethod === 'EFECTIVO' && amountReceived !== null
      ? Math.max(0, amountReceived - roundedTotal)
      : null

  // Focus search input on page mount and load active promotions
  useEffect(() => {
    cashService.getCurrent()
      .then((res) => setCashReady(res.status === 200 && res.data != null))
      .catch(() => setCashReady(false))

    searchInputRef.current?.focus()
    promotionService.getActive().then((r) => setActivePromotions(r.data)).catch(() => {})
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // ─── Product lookup helpers ────────────────────────────────────────────────

  const lookupByBarcode = useCallback(
    async (code: string) => {
      setIsSearching(true)
      try {
        const res = await apiClient.get<Product>(
          `/products/barcode/${encodeURIComponent(code.trim())}`
        )
        if (isCustomPrice(res.data)) {
          // Custom-price product — ask cashier for the amount to charge
          setCustomPriceModalProduct(res.data)
          setCustomPriceInput(null)
        } else if (isByWeight(res.data)) {
          // Weight product — ask cashier for weight before adding
          setWeightModalProduct(res.data)
          setWeightInput(null)
        } else {
          addItem(res.data)
          message.success(`"${res.data.name}" agregado al carrito`)
        }
        setSearchQuery('')
        setSearchResults([])
      } catch {
        // Not found by barcode — fall back to name search
        await lookupByName(code)
      } finally {
        setIsSearching(false)
      }
    },
    [addItem]
  )

  const lookupByName = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const params = new URLSearchParams({
        name: query.trim(),
        size: '10',
        active: 'true',
      })
      const res = await apiClient.get<{ content: Product[] }>(`/products?${params.toString()}`)
      setSearchResults(res.data.content)
    } catch {
      message.error('Error al buscar productos')
    } finally {
      setIsSearching(false)
    }
  }, [])

  // ─── Keyboard / barcode scanner handler ───────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now()
      const elapsed = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      if (e.key === 'Enter') {
        const buffer = barcodeBufferRef.current
        barcodeBufferRef.current = ''
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }

        const query = buffer.length >= MIN_SCAN_LENGTH ? buffer : searchQuery
        if (query.trim()) lookupByBarcode(query)
        return
      }

      if (e.key.length === 1) {
        if (elapsed < SCAN_SPEED_MS) {
          barcodeBufferRef.current += e.key
        } else {
          barcodeBufferRef.current = e.key
        }
      }
    },
    [lookupByBarcode, searchQuery]
  )

  // Debounced name search on input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchQuery(value)

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (!value.trim()) {
        setSearchResults([])
        return
      }
      debounceTimerRef.current = setTimeout(() => {
        lookupByName(value)
      }, 300)
    },
    [lookupByName]
  )

  // ─── Weight modal confirm ─────────────────────────────────────────────────

  const handleAddWeightProduct = () => {
    if (!weightModalProduct || !weightInput || weightInput <= 0) return
    addItem(weightModalProduct, weightInput)
    message.success(
      `"${weightModalProduct.name}" agregado — ${formatQty(weightInput)} ${weightModalProduct.unit.abbreviation}`
    )
    setWeightModalProduct(null)
    setWeightInput(null)
    setSearchResults([])
    setSearchQuery('')
    searchInputRef.current?.focus()
  }

  // ─── Custom price modal confirm ───────────────────────────────────────────

  const handleAddCustomPriceProduct = () => {
    if (!customPriceModalProduct || !customPriceInput || customPriceInput <= 0) return
    addItem(customPriceModalProduct, 1, customPriceInput)
    message.success(
      `"${customPriceModalProduct.name}" agregado — $${Math.round(customPriceInput).toLocaleString('es-CL')}`
    )
    setCustomPriceModalProduct(null)
    setCustomPriceInput(null)
    setSearchResults([])
    setSearchQuery('')
    searchInputRef.current?.focus()
  }

  // ─── Confirm sale ──────────────────────────────────────────────────────────

  const handleConfirmSale = async () => {
    if (items.length === 0) {
      message.warning('El carrito está vacío')
      return
    }
    if ((saleType === 'CREDITO' || saleType === 'MIXTO') && !selectedCustomer) {
      message.warning('Debes seleccionar un cliente para ventas a crédito')
      return
    }
    if (paymentMethod === 'EFECTIVO' && saleType === 'CONTADO' && (amountReceived === null || amountReceived < roundedTotal)) {
      message.warning('El monto recibido es insuficiente')
      return
    }

    const isCredit = saleType === 'CREDITO'
    const paidAmount = isCredit
      ? 0
      : paymentMethod === 'EFECTIVO'
        ? (amountReceived ?? roundedTotal)
        : roundedTotal
    const payload: CreateSaleRequest = {
      type: saleType,
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        ...(i.customUnitPrice !== undefined ? { customUnitPrice: i.customUnitPrice } : {}),
      })),
      ...(isCredit ? {} : { paymentMethod }),
      paymentAmount: paidAmount,
      changeAmount: !isCredit && paymentMethod === 'EFECTIVO' ? Math.max(0, paidAmount - roundedTotal) : 0,
      ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
    }

    setIsProcessing(true)
    try {
      const res = await apiClient.post<Sale>('/sales', payload)
      setCompletedSale(res.data)
      setTicketVisible(true)
      clearCart()
      setAmountReceived(null)
      setPaymentMethod('EFECTIVO')
      setSaleType('CONTADO')
      setSelectedCustomer(null)
      setCustomerOptions([])
      message.success(`Ticket #${res.data.saleNumber} registrado exitosamente`)
    } catch {
      message.error('Error al procesar la venta. Intenta nuevamente.')
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── Sale ticket modal ─────────────────────────────────────────────────────

  const renderTicket = () => {
    if (!completedSale) return null
    return (
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: token.colorSuccess }} />
            <span>Venta confirmada — Ticket #{String(completedSale.saleNumber).padStart(6, '0')}</span>
          </Space>
        }
        open={ticketVisible}
        onCancel={() => setTicketVisible(false)}
        footer={[
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
          >
            Imprimir
          </Button>,
          <Button
            key="new"
            type="primary"
            onClick={() => {
              setTicketVisible(false)
              setCompletedSale(null)
              searchInputRef.current?.focus()
            }}
          >
            Nueva venta
          </Button>,
        ]}
        width={460}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>
              Minimarket
            </Title>
            <Title level={2} style={{ margin: '4px 0', color: token.colorPrimary }}>
              #{String(completedSale.saleNumber).padStart(6, '0')}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(completedSale.createdAt).format('DD/MM/YYYY HH:mm:ss')}
            </Text>
          </div>

          <Divider dashed />

          {completedSale.details.map((d) => (
            <Row key={d.id} justify="space-between" style={{ marginBottom: 4 }}>
              <Col span={14}>
                <Text style={{ fontSize: 13 }}>{d.productName}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatQty(d.quantity)} x ${Math.round(d.unitPrice).toLocaleString('es-CL')}
                </Text>
              </Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong>${Math.round(d.subtotal).toLocaleString('es-CL')}</Text>
              </Col>
            </Row>
          ))}

          <Divider dashed />

          <Descriptions column={1} size="small">
            <Descriptions.Item label="Neto">
              ${Math.round(completedSale.totalAmount - completedSale.taxAmount).toLocaleString('es-CL')}
            </Descriptions.Item>
            <Descriptions.Item label="IVA">
              ${Math.round(completedSale.taxAmount).toLocaleString('es-CL')}
            </Descriptions.Item>
            {(() => {
              const exact = Math.round(completedSale.totalAmount)
              const rounded = roundChilean(exact)
              const diff = rounded - exact
              return diff !== 0 ? (
                <Descriptions.Item label="Redondeo">
                  <Text style={{ color: diff < 0 ? token.colorSuccess : token.colorWarning }}>
                    {diff > 0 ? '+' : ''}${diff.toLocaleString('es-CL')}
                  </Text>
                </Descriptions.Item>
              ) : null
            })()}
            <Descriptions.Item label={<Text strong>Total</Text>}>
              <Text strong style={{ fontSize: 16 }}>
                ${roundChilean(Math.round(completedSale.totalAmount)).toLocaleString('es-CL')}
              </Text>
            </Descriptions.Item>
            {completedSale.payments.map((p, idx) => (
              <React.Fragment key={idx}>
                {p.amount > 0 && (
                  <Descriptions.Item label={p.method}>
                    ${Math.round(p.amount).toLocaleString('es-CL')}
                  </Descriptions.Item>
                )}
                {p.changeAmount > 0 && (
                  <Descriptions.Item label={<Text type="success">Vuelto</Text>}>
                    <Text type="success" strong>
                      ${Math.round(p.changeAmount).toLocaleString('es-CL')}
                    </Text>
                  </Descriptions.Item>
                )}
              </React.Fragment>
            ))}
          </Descriptions>

          <Divider dashed />
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cajero: {completedSale.seller.firstName} {completedSale.seller.lastName}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {completedSale.seller.email}
            </Text>
          </div>
        </div>
      </Modal>
    )
  }

  // ─── Bloqueo si no hay caja abierta ───────────────────────────────────────

  if (cashReady === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (cashReady === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: token.borderRadiusLG }}>
          <LockOutlined style={{ fontSize: 56, color: token.colorError, marginBottom: 16 }} />
          <Title level={4} style={{ marginBottom: 8 }}>Caja no abierta</Title>
          <Text type="secondary">
            Para operar el POS debes abrir una caja primero. Dirígete a Caja, ingresa el monto inicial y comienza el turno.
          </Text>
          <Divider />
          <Button
            type="primary"
            size="large"
            icon={<WalletOutlined />}
            block
            onClick={() => navigate('/cash')}
          >
            Ir a Caja
          </Button>
        </Card>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page heading */}
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Punto de Venta
        </Title>
        <Text type="secondary">Registra ventas y gestiona el carrito</Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left column: search */}
        <Col xs={24} lg={14} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card
            variant="borderless"
            style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary }}
          >
            <Input
              ref={searchInputRef}
              size="large"
              placeholder="Escanear código de barras o buscar por nombre..."
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              allowClear
              autoComplete="off"
              style={{ fontSize: 16 }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
              Presiona Enter para buscar. Los lectores USB de código de barras son detectados
              automáticamente.
            </Text>
            {activePromotions.length > 0 && (
              <Alert
                type="success"
                message={`${activePromotions.length} promoción(es) activa(s)`}
                style={{ marginTop: 8 }}
                showIcon
              />
            )}
          </Card>

          <Card
            variant="borderless"
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              flex: 1,
              overflow: 'auto',
              minHeight: 260,
            }}
            title={
              searchResults.length > 0 ? (
                <Text type="secondary">
                  {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                </Text>
              ) : undefined
            }
          >
            {isSearching ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="Buscando..."><div /></Spin>
              </div>
            ) : searchResults.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchQuery.trim()
                    ? 'No se encontraron productos'
                    : 'Busca o escanea un producto para agregarlo al carrito'
                }
              />
            ) : (
              <List
                dataSource={searchResults}
                renderItem={(product) => (
                  <List.Item
                    key={product.id}
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          if (isCustomPrice(product)) {
                            setCustomPriceModalProduct(product)
                            setCustomPriceInput(null)
                          } else if (isByWeight(product)) {
                            setWeightModalProduct(product)
                            setWeightInput(null)
                          } else {
                            addItem(product)
                            message.success(`"${product.name}" agregado`)
                            setSearchResults([])
                            setSearchQuery('')
                            searchInputRef.current?.focus()
                          }
                        }}
                        disabled={!product.active || (product.trackStock && product.stockCurrent <= 0)}
                      >
                        {isCustomPrice(product) ? 'Ingresar monto' : isByWeight(product) ? 'Pesar' : 'Agregar'}
                      </Button>,
                    ]}
                    style={{ opacity: !product.active ? 0.5 : 1 }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{product.name}</Text>
                          {product.trackStock && product.stockCurrent <= product.stockMinimum && (
                            <Tag color="orange">Stock bajo</Tag>
                          )}
                          {!product.trackStock && (
                            <Tag color="purple">Sin control stock</Tag>
                          )}
                          {!product.active && <Tag color="red">Inactivo</Tag>}
                        </Space>
                      }
                      description={
                        <Space split="|">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {product.barcode}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {product.category.name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Stock: {product.stockCurrent}
                          </Text>
                        </Space>
                      }
                    />
                    <Text strong style={{ fontSize: 16, color: token.colorPrimary }}>
                      ${Math.round(product.salePrice).toLocaleString('es-CL')}
                    </Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Right column: cart & checkout */}
        <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card
            variant="borderless"
            title={
              <Space>
                <ShoppingCartOutlined />
                <span>Carrito ({items.length} items)</span>
              </Space>
            }
            extra={
              items.length > 0 && (
                <Button size="small" danger icon={<ClearOutlined />} onClick={clearCart}>
                  Limpiar
                </Button>
              )
            }
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              flex: 1,
              overflow: 'auto',
              minHeight: 200,
            }}
          >
            {items.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="El carrito está vacío"
                style={{ padding: 24 }}
              />
            ) : (
              <List
                dataSource={items}
                renderItem={(item) => (
                  <List.Item
                    key={item.id}
                    style={{ padding: '8px 0' }}
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeItem(item.id)}
                        aria-label={`Eliminar ${item.product.name}`}
                      />,
                    ]}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                        {item.product.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.customUnitPrice !== undefined
                          ? 'Precio libre'
                          : `$${Math.round(item.unitPrice).toLocaleString('es-CL')} / ${item.product.unit.abbreviation}`}
                      </Text>
                      <Space size={8} style={{ display: 'flex', marginTop: 4 }}>
                        {item.customUnitPrice !== undefined ? (
                          // Custom-price items are always qty=1; show amount as read-only
                          <Tag color="purple">
                            ${Math.round(item.customUnitPrice).toLocaleString('es-CL')}
                          </Tag>
                        ) : (
                          <>
                            <InputNumber
                              min={isByWeight(item.product) ? 0.001 : 1}
                              step={isByWeight(item.product) ? 0.1 : 1}
                              precision={isByWeight(item.product) ? 3 : 0}
                              max={item.product.stockCurrent || undefined}
                              value={item.quantity}
                              size="small"
                              onChange={(val) => {
                                if (val !== null) updateQuantity(item.id, val)
                              }}
                              style={{ width: isByWeight(item.product) ? 85 : 70 }}
                            />
                            {isByWeight(item.product) && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {item.product.unit.abbreviation}
                              </Text>
                            )}
                          </>
                        )}
                        <Text strong style={{ color: token.colorPrimary }}>
                          ${Math.round(item.subtotal).toLocaleString('es-CL')}
                        </Text>
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* Checkout panel */}
          <Card
            variant="borderless"
            style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {rounding !== 0 && (
                <Row justify="space-between" align="middle">
                  <Text type="secondary" style={{ fontSize: 13 }}>Subtotal:</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    ${Math.round(total).toLocaleString('es-CL')}
                  </Text>
                </Row>
              )}
              {rounding !== 0 && (
                <Row justify="space-between" align="middle">
                  <Text type="secondary" style={{ fontSize: 12 }}>Redondeo:</Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: rounding < 0 ? token.colorSuccess : token.colorWarning,
                    }}
                  >
                    {rounding > 0 ? '+' : ''}${rounding.toLocaleString('es-CL')}
                  </Text>
                </Row>
              )}
              <Row justify="space-between" align="middle">
                <Text style={{ fontSize: 16 }}>Total a pagar:</Text>
                <Title level={3} style={{ margin: 0, color: token.colorPrimary }}>
                  ${roundedTotal.toLocaleString('es-CL')}
                </Title>
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Tipo de venta
                </Text>
                <Select
                  value={saleType}
                  onChange={handleSaleTypeChange}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'CONTADO', label: 'Contado' },
                    { value: 'CREDITO', label: '🤝 Crédito' },
                    { value: 'MIXTO', label: 'Mixto' },
                  ]}
                />
              </div>

              {(saleType === 'CREDITO' || saleType === 'MIXTO') && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Cliente <Text type="danger">*</Text>
                  </Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      showSearch
                      placeholder="Buscar por nombre o RUT..."
                      filterOption={false}
                      onSearch={handleCustomerSearch}
                      loading={customerSearchLoading}
                      style={{ flex: 1 }}
                      notFoundContent={
                        customerSearchLoading
                          ? 'Buscando...'
                          : 'No encontrado — usa el botón + para crear'
                      }
                      value={selectedCustomer?.id ?? undefined}
                      onChange={(id) => {
                        const found = customerOptions.find((c) => c.id === id) ?? null
                        setSelectedCustomer(found)
                      }}
                      options={customerOptions.map((c) => ({
                        value: c.id,
                        label: (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              <strong>{c.fullName}</strong>
                              {c.rut && <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{c.rut}</span>}
                            </span>
                            <span style={{ fontSize: 12, color: c.creditUsed > 0 ? '#cf1322' : '#52c41a' }}>
                              Deuda: ${Math.round(c.creditUsed).toLocaleString('es-CL')}
                            </span>
                          </div>
                        ),
                      }))}
                    />
                    <Tooltip title="Nuevo cliente">
                      <Button
                        icon={<UserAddOutlined />}
                        onClick={() => {
                          newCustomerForm.resetFields()
                          setNewCustomerModalOpen(true)
                        }}
                      />
                    </Tooltip>
                  </Space.Compact>
                  {selectedCustomer && (
                    <div style={{
                      marginTop: 6,
                      padding: '6px 10px',
                      background: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      borderRadius: 6,
                      fontSize: 12,
                    }}>
                      <strong>{selectedCustomer.fullName}</strong>
                      {' — '}
                      Deuda actual:{' '}
                      <strong style={{ color: selectedCustomer.creditUsed > 0 ? '#cf1322' : '#52c41a' }}>
                        ${Math.round(selectedCustomer.creditUsed).toLocaleString('es-CL')}
                      </strong>
                      {selectedCustomer.creditLimit > 0 && (
                        <span style={{ color: '#888' }}>
                          {' '}/ límite ${Math.round(selectedCustomer.creditLimit).toLocaleString('es-CL')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {saleType === 'CREDITO' ? (
                <Alert
                  type="info"
                  showIcon
                  message="Venta a crédito — sin cobro inmediato"
                  description="La deuda quedará registrada en la cuenta del cliente."
                  style={{ fontSize: 12 }}
                />
              ) : (
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Método de pago
                  </Text>
                  <Select
                    value={paymentMethod}
                    onChange={(val) => {
                      setPaymentMethod(val)
                      setAmountReceived(null)
                    }}
                    style={{ width: '100%' }}
                    options={[
                      { value: 'EFECTIVO', label: 'Efectivo' },
                      { value: 'TARJETA', label: 'Tarjeta' },
                      { value: 'TRANSFERENCIA', label: 'Transferencia' },
                    ]}
                  />
                </div>
              )}

              {paymentMethod === 'EFECTIVO' && saleType !== 'CREDITO' && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Monto recibido ($)
                  </Text>
                  <InputNumber
                    min={0}
                    step={100}
                    precision={0}
                    value={amountReceived}
                    onChange={(val) => setAmountReceived(val)}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="0"
                  />
                  {change !== null && change > 0 && (
                    <Alert
                      message={`Vuelto: $${Math.round(change).toLocaleString('es-CL')}`}
                      type="success"
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                  {amountReceived !== null && amountReceived < roundedTotal && roundedTotal > 0 && (
                    <Alert
                      message="Monto insuficiente"
                      type="error"
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                </div>
              )}

              <Divider style={{ margin: '8px 0' }} />

              <Button
                type="primary"
                size="large"
                block
                icon={<CheckCircleOutlined />}
                loading={isProcessing}
                disabled={items.length === 0}
                onClick={handleConfirmSale}
                style={{ height: 48, fontSize: 16 }}
              >
                Confirmar Venta
              </Button>

              <Button
                size="large"
                block
                danger
                icon={<ClearOutlined />}
                onClick={clearCart}
                disabled={items.length === 0}
              >
                Cancelar
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {renderTicket()}

      {/* ── Weight input modal ── */}
      <Modal
        title={
          <Space>
            <span>Ingresar peso —</span>
            <Text strong>{weightModalProduct?.name}</Text>
          </Space>
        }
        open={weightModalProduct !== null}
        onCancel={() => { setWeightModalProduct(null); setWeightInput(null) }}
        onOk={handleAddWeightProduct}
        okText="Agregar al carrito"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !weightInput || weightInput <= 0 }}
        width={320}
      >
        {weightModalProduct && (
          <Space direction="vertical" style={{ width: '100%', paddingTop: 8 }} size="middle">
            <Text type="secondary">
              Precio: ${Math.round(weightModalProduct.salePrice).toLocaleString('es-CL')} / {weightModalProduct.unit.abbreviation}
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber
                autoFocus
                min={0.001}
                step={0.1}
                precision={3}
                style={{ width: '100%' }}
                size="large"
                placeholder="0.000"
                value={weightInput}
                onChange={(val) => setWeightInput(val)}
                onPressEnter={handleAddWeightProduct}
              />
              <span className="ant-input-group-addon" style={{
                display: 'flex', alignItems: 'center', padding: '0 11px',
                border: '1px solid #d9d9d9', borderLeft: 0, borderRadius: '0 6px 6px 0',
                background: '#fafafa', fontSize: 14,
              }}>{weightModalProduct.unit.abbreviation}</span>
            </Space.Compact>
            {weightInput !== null && weightInput > 0 && (
              <Text strong style={{ fontSize: 16 }}>
                Total: ${Math.round(weightModalProduct.salePrice * weightInput).toLocaleString('es-CL')}
              </Text>
            )}
          </Space>
        )}
      </Modal>

      {/* ── Custom price input modal ── */}
      <Modal
        title={
          <Space>
            <span>Ingresar monto —</span>
            <Text strong>{customPriceModalProduct?.name}</Text>
          </Space>
        }
        open={customPriceModalProduct !== null}
        onCancel={() => { setCustomPriceModalProduct(null); setCustomPriceInput(null) }}
        onOk={handleAddCustomPriceProduct}
        okText="Agregar al carrito"
        cancelText="Cancelar"
        okButtonProps={{ disabled: !customPriceInput || customPriceInput <= 0 }}
        width={320}
      >
        {customPriceModalProduct && (
          <Space direction="vertical" style={{ width: '100%', paddingTop: 8 }} size="middle">
            <Text type="secondary">
              {customPriceModalProduct.description ?? 'Ingrese el monto total a cobrar al cliente.'}
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <span className="ant-input-group-addon" style={{
                display: 'flex', alignItems: 'center', padding: '0 11px',
                border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px',
                background: '#fafafa', fontSize: 16,
              }}>$</span>
              <InputNumber
                autoFocus
                min={1}
                step={100}
                precision={0}
                style={{ width: '100%' }}
                size="large"
                placeholder="0"
                value={customPriceInput}
                onChange={(val) => setCustomPriceInput(val)}
                onPressEnter={handleAddCustomPriceProduct}
              />
            </Space.Compact>
          </Space>
        )}
      </Modal>

      {/* ── Thermal receipt — hidden on screen, visible on print only ── */}
      {completedSale && (
        <div id="receipt-print">
          <ThermalReceipt sale={completedSale} />
        </div>
      )}

      {/* ── Modal: Nuevo cliente rápido ── */}
      <Modal
        title={
          <Space>
            <UserAddOutlined />
            Nuevo Cliente
          </Space>
        }
        open={newCustomerModalOpen}
        onCancel={() => {
          setNewCustomerModalOpen(false)
          newCustomerForm.resetFields()
        }}
        onOk={handleNewCustomerSubmit}
        okText="Crear y seleccionar"
        cancelText="Cancelar"
        confirmLoading={newCustomerSubmitting}
        width={420}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          message="El límite de crédito se asigna desde la página de Clientes (ADMIN/Supervisor)."
          style={{ marginBottom: 16, fontSize: 12 }}
        />
        <Form form={newCustomerForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="Nombre"
                rules={[{ required: true, message: 'Requerido' }]}
              >
                <Input placeholder="Nombre" autoFocus />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Apellido"
                rules={[{ required: true, message: 'Requerido' }]}
              >
                <Input placeholder="Apellido" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="rut" label="RUT">
                <Input placeholder="12.345.678-9" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Teléfono">
                <Input placeholder="+56912345678" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}


export default POSPage
