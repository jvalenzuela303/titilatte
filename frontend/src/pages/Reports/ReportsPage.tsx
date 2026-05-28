import React, { useState } from 'react'
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
} from 'antd'
import {
  BarChartOutlined,
  DownloadOutlined,
  SearchOutlined,
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
} from 'recharts'
import dayjs from 'dayjs'
import { reportService } from '@/services/reportService'
import type {
  SalesReport,
  ProfitReport,
  TopProduct,
  SellerReport,
  CustomerDebt,
  DailySales,
} from '@/types'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const fmt = (v: number) =>
  `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}`

const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [
  dayjs().startOf('month'),
  dayjs(),
]

// ── Tab: Ventas ────────────────────────────────────────────────────────────

const SalesTab: React.FC = () => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SalesReport | null>(null)
  const [sellers, setSellers] = useState<SellerReport[]>([])
  const [exporting, setExporting] = useState(false)

  const generate = async () => {
    if (!range) {
      message.warning('Selecciona un rango de fechas')
      return
    }
    setLoading(true)
    try {
      const start = range[0].format('YYYY-MM-DD')
      const end = range[1].format('YYYY-MM-DD')
      const [salesRes, sellerRes] = await Promise.all([
        reportService.getSales(start, end),
        reportService.getBySeller(start, end),
      ])
      setReport(salesRes.data)
      setSellers(sellerRes.data)
    } catch {
      message.error('Error al generar el reporte de ventas')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!range) return
    setExporting(true)
    try {
      const start = range[0].format('YYYY-MM-DD')
      const end = range[1].format('YYYY-MM-DD')
      const res = await reportService.exportExcel('sales', start, end)
      // SECURITY: explicit MIME type prevents the browser from sniffing the blob as
      // text/html, which would allow a malicious server response to execute as a page.
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
            onClick={generate}
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

const ProfitTab: React.FC = () => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ProfitReport | null>(null)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await reportService.getProfit(
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
      )
      setReport(res.data)
    } catch {
      message.error('Error al generar el reporte de utilidades')
    } finally {
      setLoading(false)
    }
  }

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
            onClick={generate}
          >
            Generar Reporte
          </Button>
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

const TopProductsTab: React.FC = () => {
  const { message } = App.useApp()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<TopProduct[]>([])

  const generate = async () => {
    setLoading(true)
    try {
      const res = await reportService.getTopProducts(
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
        limit,
      )
      setProducts(res.data)
    } catch {
      message.error('Error al generar el ranking de productos')
    } finally {
      setLoading(false)
    }
  }

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
            onClick={generate}
          >
            Generar
          </Button>
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

// ── Tab: Deudores ──────────────────────────────────────────────────────────

const DebtorsTab: React.FC = () => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [debtors, setDebtors] = useState<CustomerDebt[]>([])
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportService.getDebtors()
      setDebtors(res.data as CustomerDebt[])
      setLoaded(true)
    } catch {
      message.error('Error al cargar deudores')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const res = await reportService.exportExcel('debtors', today, today)
      // SECURITY: explicit MIME type — same reasoning as the sales export above.
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
            onClick={load}
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

// ── Tab: Stock Crítico ─────────────────────────────────────────────────────

interface StockCriticalItem {
  productId: string
  productName: string
  barcode: string
  stockCurrent: number
  stockMinimum: number
  difference: number
}

const StockCriticalTab: React.FC = () => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<StockCriticalItem[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportService.getStockCritical()
      setItems(res.data as StockCriticalItem[])
    } catch {
      message.error('Error al cargar stock crítico')
    } finally {
      setLoading(false)
    }
  }

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
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={loading}
          onClick={load}
        >
          Cargar Stock Crítico
        </Button>
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
  return (
    <div>
      <Title level={3} style={{ marginBottom: 20 }}>
        <BarChartOutlined style={{ marginRight: 8 }} />
        Reportes
      </Title>

      <Tabs
        defaultActiveKey="sales"
        items={[
          { key: 'sales', label: 'Ventas', children: <SalesTab /> },
          { key: 'profit', label: 'Utilidades', children: <ProfitTab /> },
          { key: 'topProducts', label: 'Top Productos', children: <TopProductsTab /> },
          { key: 'debtors', label: 'Deudores', children: <DebtorsTab /> },
          { key: 'stockCritical', label: 'Stock Crítico', children: <StockCriticalTab /> },
        ]}
      />
    </div>
  )
}

export default ReportsPage
