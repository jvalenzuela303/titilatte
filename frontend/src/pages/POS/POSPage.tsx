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
} from 'antd'
import {
  SearchOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import apiClient from '@/config/axios'
import { useCartStore } from '@/store/cartStore'
import type { Product, Sale, SaleType, PaymentMethod, CreateSaleRequest } from '@/types'

const { Text, Title } = Typography

// ─── Barcode scanner detection ────────────────────────────────────────────────
// USB scanners send characters very fast then fire Enter.
// Heuristic: >= 3 chars arriving in < 100ms between keystrokes = barcode scan.
const SCAN_SPEED_MS = 100
const MIN_SCAN_LENGTH = 3

const POSPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotal } = useCartStore()
  const total = getTotal()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [saleType, setSaleType] = useState<SaleType>('CONTADO')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO')
  const [amountReceived, setAmountReceived] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [ticketVisible, setTicketVisible] = useState(false)

  // Barcode scanner timing state
  const lastKeyTimeRef = useRef<number>(0)
  const barcodeBufferRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const change =
    paymentMethod === 'EFECTIVO' && amountReceived !== null
      ? Math.max(0, amountReceived - total)
      : null

  // Focus search input on page mount
  useEffect(() => {
    searchInputRef.current?.focus()
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
        // Barcode exact match — add to cart directly
        addItem(res.data)
        message.success(`"${res.data.name}" agregado al carrito`)
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

  // ─── Confirm sale ──────────────────────────────────────────────────────────

  const handleConfirmSale = async () => {
    if (items.length === 0) {
      message.warning('El carrito está vacío')
      return
    }
    if (paymentMethod === 'EFECTIVO' && (amountReceived === null || amountReceived < total)) {
      message.warning('El monto recibido es insuficiente')
      return
    }

    const payload: CreateSaleRequest = {
      type: saleType,
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
      payments: [
        {
          method: paymentMethod,
          amount: paymentMethod === 'EFECTIVO' ? (amountReceived ?? total) : total,
        },
      ],
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
      message.success(`Venta #${res.data.saleNumber} registrada exitosamente`)
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
            <span>Venta completada</span>
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
            <Text type="secondary">Ticket #{completedSale.saleNumber}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(completedSale.createdAt).format('DD/MM/YYYY HH:mm')}
            </Text>
          </div>

          <Divider dashed />

          {completedSale.details.map((d) => (
            <Row key={d.id} justify="space-between" style={{ marginBottom: 4 }}>
              <Col span={14}>
                <Text style={{ fontSize: 13 }}>{d.productName}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {d.quantity} x S/. {d.unitPrice.toFixed(2)}
                </Text>
              </Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong>S/. {d.subtotal.toFixed(2)}</Text>
              </Col>
            </Row>
          ))}

          <Divider dashed />

          <Descriptions column={1} size="small">
            <Descriptions.Item label="Subtotal">
              S/. {(completedSale.totalAmount - completedSale.taxAmount).toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="Impuestos">
              S/. {completedSale.taxAmount.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>Total</Text>}>
              <Text strong style={{ fontSize: 16 }}>
                S/. {completedSale.totalAmount.toFixed(2)}
              </Text>
            </Descriptions.Item>
            {completedSale.payments.map((p, idx) => (
              <React.Fragment key={idx}>
                {p.amount > 0 && (
                  <Descriptions.Item label={`Pago (${p.method})`}>
                    S/. {p.amount.toFixed(2)}
                  </Descriptions.Item>
                )}
                {p.changeAmount > 0 && (
                  <Descriptions.Item label={<Text type="success">Vuelto</Text>}>
                    <Text type="success" strong>
                      S/. {p.changeAmount.toFixed(2)}
                    </Text>
                  </Descriptions.Item>
                )}
              </React.Fragment>
            ))}
          </Descriptions>

          <Divider dashed />
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cajero: {completedSale.sellerName}
            </Text>
          </div>
        </div>
      </Modal>
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
                <Spin tip="Buscando..." />
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
                          addItem(product)
                          message.success(`"${product.name}" agregado`)
                          setSearchResults([])
                          setSearchQuery('')
                          searchInputRef.current?.focus()
                        }}
                        disabled={!product.active || product.stockCurrent <= 0}
                      >
                        Agregar
                      </Button>,
                    ]}
                    style={{ opacity: !product.active ? 0.5 : 1 }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{product.name}</Text>
                          {product.stockCurrent <= product.stockMinimum && (
                            <Tag color="orange">Stock bajo</Tag>
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
                      S/. {product.salePrice.toFixed(2)}
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
                    key={item.product.id}
                    style={{ padding: '8px 0' }}
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeItem(item.product.id)}
                        aria-label={`Eliminar ${item.product.name}`}
                      />,
                    ]}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                        {item.product.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        S/. {item.unitPrice.toFixed(2)} c/u
                      </Text>
                      <Space size={8} style={{ display: 'flex', marginTop: 4 }}>
                        <InputNumber
                          min={1}
                          max={item.product.stockCurrent}
                          value={item.quantity}
                          size="small"
                          onChange={(val) => {
                            if (val !== null) updateQuantity(item.product.id, val)
                          }}
                          style={{ width: 70 }}
                        />
                        <Text strong style={{ color: token.colorPrimary }}>
                          S/. {item.subtotal.toFixed(2)}
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
              <Row justify="space-between" align="middle">
                <Text style={{ fontSize: 16 }}>Total a pagar:</Text>
                <Title level={3} style={{ margin: 0, color: token.colorPrimary }}>
                  S/. {total.toFixed(2)}
                </Title>
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Tipo de venta
                </Text>
                <Select
                  value={saleType}
                  onChange={(val) => setSaleType(val)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'CONTADO', label: 'Contado' },
                    { value: 'CREDITO', label: 'Crédito' },
                    { value: 'MIXTO', label: 'Mixto' },
                  ]}
                />
              </div>

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

              {paymentMethod === 'EFECTIVO' && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Monto recibido (S/.)
                  </Text>
                  <InputNumber
                    min={0}
                    step={0.5}
                    precision={2}
                    value={amountReceived}
                    onChange={(val) => setAmountReceived(val)}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="0.00"
                  />
                  {change !== null && change > 0 && (
                    <Alert
                      message={`Vuelto: S/. ${change.toFixed(2)}`}
                      type="success"
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                  {amountReceived !== null && amountReceived < total && total > 0 && (
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
    </div>
  )
}

export default POSPage
