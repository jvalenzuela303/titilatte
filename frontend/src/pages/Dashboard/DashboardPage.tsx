import { useEffect, useState, useCallback } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  Spin,
  Alert,
  Progress,
  Table,
  Tag,
  Typography,
  Space,
  List,
} from 'antd'
import {
  ShoppingOutlined,
  DollarOutlined,
  WarningOutlined,
  UserOutlined,
  WalletOutlined,
  ClockCircleOutlined,
  SmileOutlined,
} from '@ant-design/icons'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import dayjs from 'dayjs'
import api from '../../config/axios'
import { useSse } from '../../hooks/useSse'
import type {
  DashboardData,
  AdminDashboard,
  SupervisorDashboard,
  CashierDashboard,
  SellerReport,
  CashSummary,
  SseEvent,
} from '../../types'

const { Title, Text } = Typography

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos dias'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CL')}`
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<DashboardData>('/dashboard')
      setData(res.data)
      setError(null)
    } catch {
      setError('Error cargando el dashboard. Verifica la conexion con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const handleSseEvent = useCallback(
    (event: SseEvent) => {
      if (
        event.type === 'VENTA_CONFIRMADA' ||
        event.type === 'CAJA_ABIERTA' ||
        event.type === 'CAJA_CERRADA'
      ) {
        void fetchDashboard()
      }
    },
    [fetchDashboard]
  )

  useSse({
    enableNotifications: true,
    onEvent: handleSseEvent,
  })

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Error"
        description={error}
        showIcon
        style={{ maxWidth: 600, margin: '40px auto' }}
      />
    )
  }

  if (!data) return null

  if (data.dashboardType === 'ADMIN') {
    return <AdminDashboardView data={data as AdminDashboard} />
  }

  if (data.dashboardType === 'SUPERVISOR') {
    return <SupervisorDashboardView data={data as SupervisorDashboard} />
  }

  return <CashierDashboardView data={data as CashierDashboard} />
}

// ─── Admin view ───────────────────────────────────────────────────────────────

function AdminDashboardView({ data }: { data: AdminDashboard }) {
  const profitColor =
    data.profitMarginToday > 20
      ? '#52c41a'
      : data.profitMarginToday > 10
        ? '#faad14'
        : '#ff4d4f'

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Dashboard — Administrador
        </Title>
        <Text type="secondary">Resumen operacional del dia</Text>
      </div>

      {/* Row 1: KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ventas Hoy"
              value={data.salesToday}
              prefix={<ShoppingOutlined />}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {data.saleCountToday} transacciones
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Utilidad Hoy"
              value={data.profitToday}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: profitColor }}
              prefix={<DollarOutlined />}
            />
            <Progress
              percent={Math.round(data.profitMarginToday)}
              strokeColor={profitColor}
              format={(p) => `${p ?? 0}% margen`}
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Stock Critico"
              value={data.lowStockCount}
              suffix="productos"
              valueStyle={{ color: data.lowStockCount > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
            {data.lowStockCount === 0 && (
              <Text type="success" style={{ fontSize: 12 }}>
                Todo el stock en niveles normales
              </Text>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Deuda Total Clientes"
              value={data.totalDebt}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: data.debtorCount > 0 ? '#faad14' : '#52c41a' }}
              prefix={<UserOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {data.debtorCount} deudores activos
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Row 2: Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Ventas — Ultimos 30 dias">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.last30Days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => dayjs(d).format('DD/MM')}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Ventas']}
                  labelFormatter={(d: string) => dayjs(d).format('DD MMM YYYY')}
                />
                <Bar dataKey="totalAmount" fill="#1677ff" radius={[3, 3, 0, 0]} name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Tendencia — Ultimos 7 dias">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.last7Days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => dayjs(d).format('ddd')}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Ventas']}
                  labelFormatter={(d: string) => dayjs(d).format('dddd DD MMM')}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalAmount"
                  stroke="#1677ff"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Ventas"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ─── Supervisor view ──────────────────────────────────────────────────────────

const sellerColumns = [
  {
    title: 'Cajero',
    dataIndex: 'sellerEmail',
    key: 'sellerEmail',
    ellipsis: true,
  },
  {
    title: 'N Ventas',
    dataIndex: 'saleCount',
    key: 'saleCount',
    align: 'right' as const,
  },
  {
    title: 'Total',
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    align: 'right' as const,
    render: (v: number) => formatCurrency(v),
  },
]

function SupervisorDashboardView({ data }: { data: SupervisorDashboard }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Dashboard — Supervisor
        </Title>
        <Text type="secondary">Vista de operaciones en tiempo real</Text>
      </div>

      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Cajas Abiertas"
              value={data.openCashRegisters.length}
              suffix="cajas"
              prefix={<WalletOutlined />}
              valueStyle={{ color: data.openCashRegisters.length > 0 ? '#52c41a' : '#8c8c8c' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ventas Hoy"
              value={data.salesToday}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="N Transacciones"
              value={data.saleCountToday}
              suffix="ventas"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Stock Critico"
              value={data.lowStockCount}
              suffix="productos"
              prefix={<WarningOutlined />}
              valueStyle={{ color: data.lowStockCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Seller stats table */}
        <Col xs={24} lg={14}>
          <Card title="Ventas por Cajero — Hoy">
            <Table<SellerReport>
              dataSource={data.sellerStatsToday}
              columns={sellerColumns}
              rowKey="sellerId"
              size="small"
              pagination={false}
              locale={{ emptyText: 'Sin ventas registradas hoy' }}
            />
          </Card>
        </Col>

        {/* Open cash registers */}
        <Col xs={24} lg={10}>
          <Card title="Cajas Abiertas">
            {data.openCashRegisters.length === 0 ? (
              <Text type="secondary">No hay cajas abiertas en este momento</Text>
            ) : (
              <List<CashSummary>
                dataSource={data.openCashRegisters}
                rowKey="registerNumber"
                renderItem={(cash) => (
                  <List.Item>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <Tag color="green">Caja #{cash.registerNumber}</Tag>
                        <Text strong>{cash.cashierName}</Text>
                      </Space>
                      <Space split="|" style={{ fontSize: 12 }}>
                        <Text type="secondary">
                          <ClockCircleOutlined />{' '}
                          {dayjs(cash.openedAt).format('HH:mm')}
                        </Text>
                        <Text type="secondary">
                          Inicial: {formatCurrency(cash.openingAmount)}
                        </Text>
                        <Text>
                          Ventas: {formatCurrency(cash.totalSales)}
                        </Text>
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ─── Cashier view ─────────────────────────────────────────────────────────────

function CashierDashboardView({ data }: { data: CashierDashboard }) {
  const hasOpenCash = data.currentCash !== null

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          {getGreeting()}
        </Title>
        <Text type="secondary">Tu resumen del turno actual</Text>
      </div>

      {/* Turn status card */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            style={{
              borderLeft: `4px solid ${hasOpenCash ? '#52c41a' : '#faad14'}`,
              marginBottom: 8,
            }}
          >
            {hasOpenCash && data.currentCash ? (
              <Space size="large">
                <Statistic
                  title="Mi Turno Actual"
                  value={`Caja #${data.currentCash.registerNumber}`}
                  valueStyle={{ color: '#52c41a', fontSize: 22 }}
                  prefix={<WalletOutlined />}
                />
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    Apertura
                  </Text>
                  <Text strong>
                    {dayjs(data.currentCash.openedAt).format('HH:mm')} —{' '}
                    {dayjs(data.currentCash.openedAt).format('DD/MM/YYYY')}
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    Monto inicial
                  </Text>
                  <Text strong>{formatCurrency(data.currentCash.openingAmount)}</Text>
                </div>
              </Space>
            ) : (
              <Space>
                <SmileOutlined style={{ fontSize: 24, color: '#faad14' }} />
                <div>
                  <Text strong style={{ fontSize: 16 }}>
                    Abre tu caja para comenzar el turno
                  </Text>
                  <br />
                  <Text type="secondary">
                    Ve al modulo de Caja y realiza la apertura para registrar ventas.
                  </Text>
                </div>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* My stats */}
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Mis Ventas Hoy"
              value={data.myTotalSalesToday}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Numero de Ventas"
              value={data.mySaleCountToday}
              suffix="transacciones"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Efectivo en Caja"
              value={data.myTotalCash}
              formatter={(v) => formatCurrency(Number(v))}
              prefix={<DollarOutlined />}
              valueStyle={{ color: data.myTotalCash > 0 ? '#52c41a' : '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
