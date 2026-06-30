import React, { useState, useEffect, useCallback } from 'react'
import {
  Tabs,
  Card,
  Button,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Typography,
  Tag,
  Space,
  Spin,
  Alert,
  App,
  Tooltip,
  Select,
} from 'antd'
import {
  BarChartOutlined,
  DownloadOutlined,
  SearchOutlined,
  SyncOutlined,
  ShoppingOutlined,
  CreditCardOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import dayjs from 'dayjs'
import { reportService } from '@/services/reportService'
import { orderService } from '@/services/orderService'
import { useSse } from '@/hooks/useSse'
import type {
  SalesReport,
  ProfitReport,
  TopProduct,
  SellerReport,
  CustomerDebt,
  DailySales,
  Order,
  PaymentMethodSummary,
  CategorySalesItem,
  CategorySalesReportResponse,
} from '@/types'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const fmt = (v: number) =>
  `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}`

const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [
  dayjs().startOf('month'),
  dayjs(),
]

function LastUpdated({ at }: { at: Date | null }) {
  if (!at) return null
  return (
    <Tooltip title={dayjs(at).format('DD/MM/YYYY HH:mm:ss')}>
      <Tag icon={<SyncOutlined />} color="processing" style={{ fontSize: 11 }}>
        Actualizado {dayjs(at).format('HH:mm:ss')}
      </Tag>
    </Tooltip>
  )
}

// ── Payment method breakdown ───────────────────────────────────────────────

const PAYMENT_METHOD_CONFIG: Record<
  PaymentMethodSummary['method'],
  { label: string; color: string }
> = {
  EFECTIVO:      { label: 'Efectivo',      color: '#52c41a' },
  TARJETA:       { label: 'Tarjeta',       color: '#1677ff' },
  TRANSFERENCIA: { label: 'Transferencia', color: '#fa8c16' },
  CREDITO:       { label: 'Crédito',       color: '#722ed1' },
}

const PaymentMethodBreakdown: React.FC<{ breakdown: PaymentMethodSummary[] }> = ({
  breakdown,
}) => {
  if (breakdown.length === 0) return null

  const pieData = breakdown.map((item) => ({
    name: PAYMENT_METHOD_CONFIG[item.method]?.label ?? item.method,
    value: item.totalAmount,
    color: PAYMENT_METHOD_CONFIG[item.method]?.color ?? '#8c8c8c',
  }))

  return (
    <Card title="Desglose por Método de Pago" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={12}>
          <Row gutter={[12, 12]}>
            {breakdown.map((item) => {
              const cfg = PAYMENT_METHOD_CONFIG[item.method] ?? {
                label: item.method,
                color: '#8c8c8c',
              }
              return (
                <Col xs={24} sm={12} key={item.method}>
                  <Card
                    size="small"
                    style={{ borderLeft: `4px solid ${cfg.color}` }}
                    variant="borderless"
                  >
                    <Statistic
                      title={cfg.label}
                      value={item.totalAmount}
                      prefix="$"
                      precision={0}
                      valueStyle={{ color: cfg.color, fontSize: 18 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.transactionCount} transacción{item.transactionCount !== 1 ? 'es' : ''}
                    </Text>
                  </Card>
                </Col>
              )
            })}
          </Row>
        </Col>
        <Col xs={24} md={12}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number) => [fmt(value), 'Monto']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </Card>
  )
}

// ── Tab: Ventas ────────────────────────────────────────────────────────────

const SalesTab: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [sellers, setSellers] = useState<SellerReport[]>([])
  const [exporting, setExporting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const generate = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const start = range[0].format('YYYY-MM-DD')
      const end = range[1].format('YYYY-MM-DD')
      const [salesRes, sellerRes] = await Promise.all([
        reportService.getSales(start, end),
        reportService.getBySeller(start, end),
      ])
      setReport(salesRes.data)
      setSellers(sellerRes.data)
      setLastUpdated(new Date())
    } catch {
      if (!silent) message.error('Error al generar el reporte de ventas')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [range, message])

  // Auto-refresh cuando llega una venta nueva (solo si ya se generó el reporte)
  useEffect(() => {
    if (refreshTrigger > 0 && report !== null) {
      void generate(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const handleExport = async () => {
    if (!range) return
    setExporting(true)
    try {
      const start = range[0].format('YYYY-MM-DD')
      const end = range[1].format('YYYY-MM-DD')
      const res = await reportService.exportExcel('sales', start, end)
      const url = window.URL.createObjectURL(
        new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas_${start}_${end}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Error al exportar el reporte')
    } finally {
      setExporting(false)
    }
  }

  const sellerColumns: ColumnsType<SellerReport> = [
    { title: 'Vendedor', dataIndex: 'sellerEmail', key: 'sellerEmail', ellipsis: true },
    { title: 'N° Ventas', dataIndex: 'saleCount', key: 'saleCount', align: 'right' },
    {
      title: 'Monto Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: fmt,
    },
  ]

  const chartData = (report?.dailyBreakdown ?? []).map((d: DailySales) => ({
    date: dayjs(d.date).format('DD/MM'),
    ventas: d.saleCount,
    monto: d.totalAmount,
  }))

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={(vals) =>
              setRange((vals as [dayjs.Dayjs, dayjs.Dayjs]) ?? defaultRange)
            }
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => generate(false)}
          >
            Generar Reporte
          </Button>
          {report && (
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              Exportar Excel
            </Button>
          )}
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && report && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="N° de Ventas" value={report.totalSales} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Monto Total"
                  value={report.totalAmount}
                  prefix="$"
                  precision={0}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Total Descuentos"
                  value={report.totalDiscount}
                  prefix="$"
                  precision={0}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

          {chartData.length > 0 && (
            <Card title="Ventas por Día" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) =>
                      name === 'monto' ? [fmt(value), 'Monto'] : [value, 'Ventas']
                    }
                  />
                  <Bar yAxisId="left" dataKey="monto" fill="#1677ff" name="monto" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="right" dataKey="ventas" fill="#52c41a" name="ventas" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {(report.paymentMethodBreakdown?.length ?? 0) > 0 && (
            <PaymentMethodBreakdown
              breakdown={report.paymentMethodBreakdown!}
            />
          )}

          {sellers.length > 0 && (
            <Card title="Ventas por Vendedor">
              <Table
                rowKey="sellerId"
                dataSource={sellers}
                columns={sellerColumns}
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── Tab: Utilidades ────────────────────────────────────────────────────────

const ProfitTab: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ProfitReport | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const generate = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await reportService.getProfit(
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
      )
      setReport(res.data)
      setLastUpdated(new Date())
    } catch {
      if (!silent) message.error('Error al generar el reporte de utilidades')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [range, message])

  useEffect(() => {
    if (refreshTrigger > 0 && report !== null) {
      void generate(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const marginColor = (pct: number) => {
    if (pct > 20) return '#52c41a'
    if (pct > 10) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={(vals) =>
              setRange((vals as [dayjs.Dayjs, dayjs.Dayjs]) ?? defaultRange)
            }
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => generate(false)}
          >
            Generar Reporte
          </Button>
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && report && (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Ingresos Totales"
                value={report.totalRevenue}
                prefix="$"
                precision={0}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Costos Totales"
                value={report.totalCost}
                prefix="$"
                precision={0}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Utilidad Bruta"
                value={report.totalProfit}
                prefix="$"
                precision={0}
                valueStyle={{ color: report.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Margen %"
                value={report.profitMargin}
                suffix="%"
                precision={1}
                valueStyle={{ color: marginColor(report.profitMargin) }}
              />
              {report.profitMargin > 20 && <Tag color="success" style={{ marginTop: 8 }}>Excelente</Tag>}
              {report.profitMargin > 10 && report.profitMargin <= 20 && <Tag color="warning" style={{ marginTop: 8 }}>Moderado</Tag>}
              {report.profitMargin <= 10 && <Tag color="error" style={{ marginTop: 8 }}>Bajo</Tag>}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}

// ── Tab: Top Productos ─────────────────────────────────────────────────────

const TopProductsTab: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<TopProduct[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const generate = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await reportService.getTopProducts(
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
        limit,
      )
      setProducts(res.data)
      setLastUpdated(new Date())
    } catch {
      if (!silent) message.error('Error al generar el ranking de productos')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [range, limit, message])

  useEffect(() => {
    if (refreshTrigger > 0 && products.length > 0) {
      void generate(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const maxAmount = products.length > 0 ? Math.max(...products.map((p) => p.totalAmount)) : 1

  const columns: ColumnsType<TopProduct> = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      render: (v: number) => <Text strong style={{ color: v <= 3 ? '#faad14' : undefined }}>{v}</Text>,
    },
    { title: 'Producto', dataIndex: 'productName', key: 'productName' },
    {
      title: 'Cantidad Vendida',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      align: 'right',
      width: 140,
    },
    {
      title: 'Monto Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 130,
      render: fmt,
    },
    {
      title: '% del Total',
      key: 'progress',
      width: 160,
      render: (_, record) => (
        <Progress
          percent={Math.round((record.totalAmount / maxAmount) * 100)}
          size="small"
          strokeColor="#1677ff"
        />
      ),
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={(vals) =>
              setRange((vals as [dayjs.Dayjs, dayjs.Dayjs]) ?? defaultRange)
            }
          />
          <Space align="center">
            <Typography.Text>Top</Typography.Text>
            <InputNumber
              min={1}
              max={50}
              value={limit}
              onChange={(v) => setLimit(v ?? 10)}
              style={{ width: 80 }}
            />
          </Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => generate(false)}
          >
            Generar
          </Button>
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="productId"
          dataSource={products}
          columns={columns}
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}

// ── Tab: Pedidos ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Pendiente',    color: 'blue' },
  IN_PROGRESS: { label: 'En preparación', color: 'processing' },
  READY:       { label: 'Listo',        color: 'cyan' },
  DELIVERED:   { label: 'Entregado',    color: 'success' },
  CANCELLED:   { label: 'Cancelado',    color: 'default' },
}

const PAY_LABELS: Record<string, { label: string; color: string }> = {
  UNPAID:  { label: 'Sin abonar', color: 'error' },
  PARTIAL: { label: 'Parcial',    color: 'warning' },
  PAID:    { label: 'Pagado',     color: 'success' },
}

const OrdersReportTab: React.FC = () => {
  const { message } = App.useApp()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await orderService.getAll({
        page: 0,
        size: 200,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      setOrders(res.data.content)
      setLoaded(true)
      setLastUpdated(new Date())
    } catch {
      message.error('Error al cargar pedidos')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, message])

  const totalAmount   = orders.reduce((s, o) => s + o.totalAmount, 0)
  const totalPaid     = orders.reduce((s, o) => s + (o.amountPaid ?? 0), 0)
  const totalPending  = orders.reduce((s, o) => s + (o.pendingAmount ?? 0), 0)

  const countByStatus = Object.keys(STATUS_LABELS).reduce<Record<string, number>>((acc, k) => {
    acc[k] = orders.filter((o) => o.status === k).length
    return acc
  }, {})

  const columns: ColumnsType<Order> = [
    {
      title: 'N°',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 60,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      key: 'customerName',
      ellipsis: true,
    },
    {
      title: 'Productos',
      key: 'items',
      render: (_: unknown, r: Order) => {
        const items = r.items ?? []
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {items.length === 0 ? '—' : items.slice(0, 2).map((i) => i.productName).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '')}
          </Text>
        )
      },
    },
    {
      title: 'Entrega',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      render: (v: string) => {
        const d = dayjs(v)
        const overdue = d.isBefore(dayjs())
        return (
          <Text style={{ color: overdue ? '#cf1322' : undefined, fontSize: 12 }}>
            {d.format('DD/MM/YYYY')}<br />
            <Text type="secondary" style={{ fontSize: 11 }}>{d.format('HH:mm')} hrs</Text>
          </Text>
        )
      },
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 110,
      render: fmt,
    },
    {
      title: 'Abonado',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      align: 'right',
      width: 110,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>{fmt(v ?? 0)}</Text>,
    },
    {
      title: 'Pendiente',
      dataIndex: 'pendingAmount',
      key: 'pendingAmount',
      align: 'right',
      width: 110,
      render: (v: number) => (
        <Text style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>{fmt(v ?? 0)}</Text>
      ),
    },
    {
      title: 'Estado',
      key: 'status',
      width: 130,
      render: (_: unknown, r: Order) => (
        <Space direction="vertical" size={2}>
          <Tag color={STATUS_LABELS[r.status]?.color ?? 'default'} style={{ fontSize: 11 }}>
            {STATUS_LABELS[r.status]?.label ?? r.status}
          </Tag>
          <Tag color={PAY_LABELS[r.paymentStatus]?.color ?? 'default'} style={{ fontSize: 11 }}>
            {PAY_LABELS[r.paymentStatus]?.label ?? r.paymentStatus}
          </Tag>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Todos los estados"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={load}>
            Cargar Pedidos
          </Button>
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>

      {loaded && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic title="Total Pedidos" value={orders.length} prefix={<ShoppingOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic title="Monto Total" value={totalAmount} formatter={(v) => fmt(Number(v))} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic title="Total Abonado" value={totalPaid} formatter={(v) => fmt(Number(v))} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small">
                <Statistic title="Pendiente Cobro" value={totalPending} formatter={(v) => fmt(Number(v))} valueStyle={{ color: totalPending > 0 ? '#cf1322' : '#52c41a' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              countByStatus[k] > 0 && (
                <Col key={k}>
                  <Tag color={v.color} style={{ padding: '4px 10px', fontSize: 13 }}>
                    {v.label}: <strong>{countByStatus[k]}</strong>
                  </Tag>
                </Col>
              )
            ))}
          </Row>
        </>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}

      {!loading && loaded && (
        <Card>
          <Table
            rowKey="id"
            dataSource={orders}
            columns={columns}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: 'Sin pedidos' }}
          />
        </Card>
      )}
    </div>
  )
}

// ── Tab: Créditos (Deudores) ───────────────────────────────────────────────

const DebtorsTab: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [debtors, setDebtors] = useState<CustomerDebt[]>([])
  const [exporting, setExporting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await reportService.getDebtors()
      setDebtors(res.data as CustomerDebt[])
      setLoaded(true)
      setLastUpdated(new Date())
    } catch {
      if (!silent) message.error('Error al cargar deudores')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [message])

  useEffect(() => {
    if (refreshTrigger > 0 && loaded) {
      void load(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const handleExport = async () => {
    setExporting(true)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const res = await reportService.exportExcel('debtors', today, today)
      const url = window.URL.createObjectURL(
        new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `deudores_${today}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<CustomerDebt> = [
    { title: 'Cliente', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'RUT',
      dataIndex: 'rut',
      key: 'rut',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Límite',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      align: 'right',
      render: fmt,
    },
    {
      title: 'Deuda',
      dataIndex: 'creditUsed',
      key: 'creditUsed',
      align: 'right',
      render: (v: number) => <Text style={{ color: '#ff4d4f' }}>{fmt(v)}</Text>,
    },
    {
      title: 'Disponible',
      dataIndex: 'available',
      key: 'available',
      align: 'right',
      render: fmt,
    },
    {
      title: '% Utilizado',
      key: 'pct',
      width: 150,
      render: (_, r) => {
        const pct =
          r.creditLimit > 0
            ? Math.min(Math.round((r.creditUsed / r.creditLimit) * 100), 100)
            : 0
        return (
          <Space>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct >= 100 ? '#ff4d4f' : pct >= 80 ? '#fa8c16' : '#52c41a'}
              style={{ width: 80 }}
            />
            <Text style={{ fontSize: 12 }}>{pct}%</Text>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => load(false)}
          >
            Cargar Deudores
          </Button>
          {loaded && (
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              Exportar Excel
            </Button>
          )}
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="customerId"
          dataSource={debtors}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          size="small"
        />
      </Card>
    </div>
  )
}

// ── Tab: Ventas por Categoría ──────────────────────────────────────────────

const CategorySalesTab: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<CategorySalesReportResponse | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const generate = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const start = range[0].format('YYYY-MM-DD')
      const end = range[1].format('YYYY-MM-DD')
      const res = await reportService.getCategorySalesReport(start, end)
      setReportData(res.data)
      setLastUpdated(new Date())
    } catch {
      if (!silent) message.error('Error al generar el reporte por categoría')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [range, message])

  useEffect(() => {
    if (refreshTrigger > 0 && reportData !== null) {
      void generate(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  const categories = reportData?.categories ?? []

  const totalUnits = categories.reduce((s, c) => s + c.totalUnits, 0)
  const activeCategoryCount = categories.length

  // Sort descending by totalAmount for the chart
  const chartData = [...categories]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 12)
    .map((c) => ({
      name: c.categoryName.length > 18 ? `${c.categoryName.slice(0, 16)}…` : c.categoryName,
      fullName: c.categoryName,
      monto: c.totalAmount,
    }))

  const categoryColumns: ColumnsType<CategorySalesItem> = [
    {
      title: 'Familia',
      dataIndex: 'familyName',
      key: 'familyName',
      sorter: (a, b) => a.familyName.localeCompare(b.familyName),
      filters: Array.from(new Set(categories.map((c) => c.familyName))).map((f) => ({
        text: f,
        value: f,
      })),
      onFilter: (value, record) => record.familyName === value,
    },
    {
      title: 'Categoría',
      dataIndex: 'categoryName',
      key: 'categoryName',
      sorter: (a, b) => a.categoryName.localeCompare(b.categoryName),
    },
    {
      title: 'Productos vendidos',
      dataIndex: 'productCount',
      key: 'productCount',
      align: 'right',
      width: 150,
      sorter: (a, b) => a.productCount - b.productCount,
    },
    {
      title: 'Unidades',
      dataIndex: 'totalUnits',
      key: 'totalUnits',
      align: 'right',
      width: 110,
      sorter: (a, b) => a.totalUnits - b.totalUnits,
    },
    {
      title: 'Descuentos',
      dataIndex: 'totalDiscount',
      key: 'totalDiscount',
      align: 'right',
      width: 120,
      render: fmt,
      sorter: (a, b) => a.totalDiscount - b.totalDiscount,
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 130,
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v: number) => (
        <Text strong style={{ color: '#1677ff' }}>
          {fmt(v)}
        </Text>
      ),
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={(vals) =>
              setRange((vals as [dayjs.Dayjs, dayjs.Dayjs]) ?? defaultRange)
            }
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => generate(false)}
          >
            Generar Reporte
          </Button>
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && reportData && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Total Vendido"
                  value={reportData.grandTotal}
                  prefix="$"
                  precision={0}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Total Unidades"
                  value={totalUnits}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Categorías Activas"
                  value={activeCategoryCount}
                />
              </Card>
            </Col>
          </Row>

          {chartData.length > 0 && (
            <Card title="Monto por Categoría (Top 12)" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 36)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fontSize: 12 }}
                  />
                  <RechartsTooltip
                    formatter={(value: number, _name: string, props: { payload?: { fullName?: string } }) => [
                      fmt(value),
                      props.payload?.fullName ?? 'Monto',
                    ]}
                  />
                  <Bar dataKey="monto" fill="#1677ff" radius={[0, 3, 3, 0]} name="Monto" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <Table
              rowKey="categoryId"
              dataSource={categories}
              columns={categoryColumns}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              locale={{ emptyText: 'Sin datos de categorías para el período' }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

// ── Tab: Stock Crítico ─────────────────────────────────────────────────────

interface StockCriticalItem {
  productId: string
  productName: string
  barcode: string
  stockCurrent: number
  stockMinimum: number
  difference: number
}

const StockCriticalTab: React.FC<{ stockTrigger: number }> = ({ stockTrigger }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<StockCriticalItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await reportService.getStockCritical()
      setItems(res.data as StockCriticalItem[])
      setLastUpdated(new Date())
    } catch {
      if (!silent) message.error('Error al cargar stock crítico')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [message])

  useEffect(() => {
    if (stockTrigger > 0 && items.length > 0) {
      void load(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockTrigger])

  const rowStyle = (record: StockCriticalItem): React.CSSProperties => {
    if (record.stockCurrent === 0) return { background: '#fff1f0' }
    if (record.stockCurrent < record.stockMinimum) return { background: '#fff7e6' }
    return {}
  }

  const columns: ColumnsType<StockCriticalItem> = [
    { title: 'Producto', dataIndex: 'productName', key: 'productName' },
    { title: 'Código Barras', dataIndex: 'barcode', key: 'barcode', width: 140 },
    {
      title: 'Stock Actual',
      dataIndex: 'stockCurrent',
      key: 'stockCurrent',
      align: 'right',
      width: 120,
      render: (v: number) => (
        <Text strong style={{ color: v === 0 ? '#ff4d4f' : '#fa8c16' }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Stock Mínimo',
      dataIndex: 'stockMinimum',
      key: 'stockMinimum',
      align: 'right',
      width: 120,
    },
    {
      title: 'Diferencia',
      dataIndex: 'difference',
      key: 'difference',
      align: 'right',
      width: 110,
      render: (v: number) => (
        <Text style={{ color: v < 0 ? '#ff4d4f' : undefined }}>{v}</Text>
      ),
    },
    {
      title: 'Estado',
      key: 'status',
      width: 120,
      render: (_, record) => {
        if (record.stockCurrent === 0) return <Tag color="error">Sin Stock</Tag>
        return <Tag color="warning">Stock Bajo</Tag>
      },
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => load(false)}
          >
            Cargar Stock Crítico
          </Button>
          <LastUpdated at={lastUpdated} />
        </Space>
      </Card>

      {items.length > 0 && (
        <Alert
          type="warning"
          message={`${items.length} producto(s) con stock bajo o sin stock`}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      <Card>
        <Table
          rowKey="productId"
          dataSource={items}
          columns={columns}
          loading={loading}
          onRow={(record) => ({ style: rowStyle(record) })}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          size="small"
        />
      </Card>
    </div>
  )
}

// ── Main ReportsPage ───────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  // Trigger para tabs que dependen de ventas (Ventas, Utilidades, Top Productos, Deudores)
  const [salesTrigger, setSalesTrigger] = useState(0)
  // Trigger para Stock Crítico (se actualiza también con STOCK_CRITICO)
  const [stockTrigger, setStockTrigger] = useState(0)

  useSse({
    onEvent: (event) => {
      if (event.type === 'VENTA_CONFIRMADA') {
        setSalesTrigger((n) => n + 1)
        setStockTrigger((n) => n + 1)
      }
      if (event.type === 'STOCK_CRITICO') {
        setStockTrigger((n) => n + 1)
      }
    },
  })

  return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>
        <BarChartOutlined style={{ marginRight: 8 }} />
        Reportes
      </Title>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="¿Qué son los Reportes?"
        description="Accede a informes detallados de ventas, utilidades, productos más vendidos, ventas por categoría, créditos pendientes y stock crítico. Puedes exportar los datos a Excel."
      />

      <Tabs
        defaultActiveKey="sales"
        items={[
          {
            key: 'sales',
            label: 'Ventas',
            children: <SalesTab refreshTrigger={salesTrigger} />,
          },
          {
            key: 'profit',
            label: 'Utilidades',
            children: <ProfitTab refreshTrigger={salesTrigger} />,
          },
          {
            key: 'topProducts',
            label: 'Top Productos',
            children: <TopProductsTab refreshTrigger={salesTrigger} />,
          },
          {
            key: 'byCategory',
            label: 'Por Categoría',
            children: <CategorySalesTab refreshTrigger={salesTrigger} />,
          },
          {
            key: 'orders',
            label: (
              <span><ShoppingOutlined style={{ marginRight: 4 }} />Pedidos</span>
            ),
            children: <OrdersReportTab />,
          },
          {
            key: 'debtors',
            label: (
              <span><CreditCardOutlined style={{ marginRight: 4 }} />Créditos</span>
            ),
            children: <DebtorsTab refreshTrigger={salesTrigger} />,
          },
          {
            key: 'stockCritical',
            label: 'Stock Crítico',
            children: <StockCriticalTab stockTrigger={stockTrigger} />,
          },
        ]}
      />
    </div>
  )
}

export default ReportsPage
