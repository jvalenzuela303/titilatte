import React, { useState, useCallback, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  Modal,
  Descriptions,
  Divider,
  App,
  Input,
  theme,
  Badge,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  StopOutlined,
  EyeOutlined,
  ShoppingOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import saleService from '@/services/saleService'
import { useAuth } from '@/hooks/useAuth'
import type { Sale, SaleStatus } from '@/types'
import ThermalReceipt from '@/components/ThermalReceipt'
import '@/styles/print.css'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLOR: Record<SaleStatus, string> = {
  CONFIRMED: 'success',
  PENDING: 'processing',
  CANCELLED: 'error',
}
const STATUS_LABEL: Record<SaleStatus, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelada',
}

const SalesPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { isAdmin, isSupervisor } = useAuth()
  const canCancel = isAdmin || isSupervisor

  // ── Filters ──────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().endOf('day'),
  ])
  const [statusFilter, setStatusFilter] = useState<string>('')

  // ── Data ─────────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 20

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Cancel modal ──────────────────────────────────────────────────────────
  const [cancelSale, setCancelSale] = useState<Sale | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────
  const fetchSales = useCallback(
    async (p = 0) => {
      setLoading(true)
      try {
        const res = await saleService.getSales({
          page: p,
          size: PAGE_SIZE,
          startDate: dateRange[0].toISOString(),
          endDate: dateRange[1].toISOString(),
          status: statusFilter || undefined,
        })
        setSales(res.data.content)
        setTotal(res.data.totalElements)
        setPage(p)
      } catch {
        message.error('Error al cargar las ventas')
      } finally {
        setLoading(false)
      }
    },
    [dateRange, statusFilter]
  )

  useEffect(() => {
    fetchSales(0)
  }, [fetchSales])

  // ── Summary stats ─────────────────────────────────────────────────────────
  const confirmed = sales.filter((s) => s.status === 'CONFIRMED')
  const totalRevenue = confirmed.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalTax = confirmed.reduce((sum, s) => sum + s.taxAmount, 0)

  // ── Cancel handler ────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelSale || !cancelReason.trim()) {
      message.warning('Ingresa un motivo de cancelación')
      return
    }
    setCancelLoading(true)
    try {
      await saleService.cancelSale(cancelSale.id, cancelReason.trim())
      message.success(`Venta #${String(cancelSale.saleNumber).padStart(6, '0')} cancelada`)
      setCancelSale(null)
      setCancelReason('')
      fetchSales(page)
    } catch {
      message.error('No se pudo cancelar la venta')
    } finally {
      setCancelLoading(false)
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<Sale> = [
    {
      title: 'Ticket',
      dataIndex: 'saleNumber',
      width: 90,
      render: (n: number) => (
        <Text strong style={{ fontFamily: 'monospace', color: token.colorPrimary }}>
          #{String(n).padStart(6, '0')}
        </Text>
      ),
    },
    {
      title: 'Hora',
      dataIndex: 'createdAt',
      width: 80,
      render: (d: string) => dayjs(d).format('HH:mm'),
    },
    {
      title: 'Cajero',
      dataIndex: 'seller',
      ellipsis: true,
      render: (s: Sale['seller']) => `${s.firstName} ${s.lastName}`,
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      width: 90,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: 'Items',
      dataIndex: 'details',
      width: 70,
      align: 'center',
      render: (d: Sale['details']) => <Badge count={d.length} color={token.colorPrimary} />,
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <Text strong>${Math.round(v).toLocaleString('es-CL')}</Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (s: SaleStatus) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setDetailSale(record); setDetailOpen(true) }}
          />
          {canCancel && record.status === 'CONFIRMED' && (
            <Button
              type="text"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => { setCancelSale(record); setCancelReason('') }}
            />
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Historial de Ventas
        </Title>
        <Text type="secondary">Consulta y gestiona las ventas registradas</Text>
      </div>

      {/* Summary cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ boxShadow: token.boxShadowTertiary }}>
            <Statistic
              title="Ventas confirmadas"
              value={confirmed.length}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ boxShadow: token.boxShadowTertiary }}>
            <Statistic
              title="Ingresos"
              value={Math.round(totalRevenue)}
              prefix="$"
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ boxShadow: token.boxShadowTertiary }}>
            <Statistic
              title="IVA (19%)"
              value={Math.round(totalTax)}
              prefix="$"
              valueStyle={{ color: token.colorWarning }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ boxShadow: token.boxShadowTertiary }}>
            <Statistic
              title="Canceladas"
              value={sales.filter((s) => s.status === 'CANCELLED').length}
              valueStyle={{ color: token.colorError }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters + table */}
      <Card variant="borderless" style={{ boxShadow: token.boxShadowTertiary }}>
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }} align="middle">
          <Col xs={24} sm={12} md={10}>
            <RangePicker
              value={dateRange}
              onChange={(v) => {
                if (v?.[0] && v?.[1]) setDateRange([v[0], v[1]])
              }}
              showTime={{ format: 'HH:mm' }}
              format="DD/MM/YYYY HH:mm"
              style={{ width: '100%' }}
              presets={[
                { label: 'Hoy', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
                { label: 'Ayer', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
                { label: 'Esta semana', value: [dayjs().startOf('week'), dayjs().endOf('day')] },
                { label: 'Este mes', value: [dayjs().startOf('month'), dayjs().endOf('day')] },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'CONFIRMED', label: 'Confirmadas' },
                { value: 'CANCELLED', label: 'Canceladas' },
                { value: 'PENDING', label: 'Pendientes' },
              ]}
            />
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchSales(0)}
              style={{ width: '100%' }}
            >
              Actualizar
            </Button>
          </Col>
        </Row>

        <Table
          dataSource={sales}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} ventas`,
            onChange: (p) => fetchSales(p - 1),
          }}
          rowClassName={(r) => (r.status === 'CANCELLED' ? 'ant-table-row-cancelled' : '')}
        />
      </Card>

      {/* Detail modal */}
      <Modal
        title={
          detailSale
            ? `Venta #${String(detailSale.saleNumber).padStart(6, '0')} — ${dayjs(detailSale.createdAt).format('DD/MM/YYYY HH:mm')}`
            : ''
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Space>
            {detailSale?.status === 'CONFIRMED' && (
              <Button
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
              >
                Imprimir boleta
              </Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
          </Space>
        }
        width={600}
        forceRender
      >
        {detailSale && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Estado">
                <Tag color={STATUS_COLOR[detailSale.status]}>{STATUS_LABEL[detailSale.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tipo">{detailSale.type}</Descriptions.Item>
              <Descriptions.Item label="Cajero">
                {detailSale.seller.firstName} {detailSale.seller.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong>${Math.round(detailSale.totalAmount).toLocaleString('es-CL')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="IVA">
                ${Math.round(detailSale.taxAmount).toLocaleString('es-CL')}
              </Descriptions.Item>
              <Descriptions.Item label="Neto">
                ${Math.round(detailSale.totalAmount - detailSale.taxAmount).toLocaleString('es-CL')}
              </Descriptions.Item>
              {detailSale.cancellationReason && (
                <Descriptions.Item label="Motivo cancelación" span={2}>
                  <Text type="danger">{detailSale.cancellationReason}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" plain style={{ margin: '8px 0' }}>
              Productos
            </Divider>
            <Table
              dataSource={detailSale.details}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Producto', dataIndex: 'productName', ellipsis: true },
                { title: 'Cant.', dataIndex: 'quantity', width: 60, align: 'right' as const },
                {
                  title: 'P. Unit.',
                  dataIndex: 'unitPrice',
                  width: 100,
                  align: 'right' as const,
                  render: (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`,
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  width: 100,
                  align: 'right' as const,
                  render: (v: number) => <Text strong>${Math.round(v).toLocaleString('es-CL')}</Text>,
                },
              ]}
            />

            <Divider orientation="left" plain style={{ margin: '8px 0' }}>
              Pago
            </Divider>
            <Table
              dataSource={detailSale.payments}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Método', dataIndex: 'method', width: 130 },
                {
                  title: 'Monto',
                  dataIndex: 'amount',
                  align: 'right' as const,
                  render: (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`,
                },
                {
                  title: 'Vuelto',
                  dataIndex: 'changeAmount',
                  align: 'right' as const,
                  render: (v: number) =>
                    v > 0 ? <Text type="success">${Math.round(v).toLocaleString('es-CL')}</Text> : '—',
                },
              ]}
            />
          </>
        )}
      </Modal>

      {/* Boleta térmica — invisible en pantalla, aparece al imprimir */}
      {detailSale && (
        <div id="receipt-print">
          <ThermalReceipt sale={detailSale} />
        </div>
      )}

      {/* Cancel modal */}
      <Modal
        title={
          cancelSale
            ? `Cancelar venta #${String(cancelSale.saleNumber).padStart(6, '0')}`
            : ''
        }
        open={!!cancelSale}
        onCancel={() => { setCancelSale(null); setCancelReason('') }}
        onOk={handleCancel}
        okText="Confirmar cancelación"
        okButtonProps={{ danger: true, loading: cancelLoading }}
        cancelText="Volver"
        forceRender
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Esta acción restaurará el stock de los productos vendidos.
        </Text>
        <Input.TextArea
          placeholder="Motivo de cancelación (obligatorio)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  )
}

export default SalesPage
