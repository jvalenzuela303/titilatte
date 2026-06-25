import React, { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  Form,
  InputNumber,
  Select,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Descriptions,
  App,
  Divider,
  Empty,
  Badge,
} from 'antd'
import {
  DollarOutlined,
  SearchOutlined,
  ReloadOutlined,
  HistoryOutlined,
  UserOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import { customerService } from '@/services/customerService'
import type { Customer } from '@/types'
import apiClient from '@/config/axios'

const { Text, Title } = Typography
const { TextArea } = Input

const fmt = (v: number) =>
  `$${Math.round(v).toLocaleString('es-CL', { minimumFractionDigits: 0 })}`

const creditPercent = (used: number, limit: number) =>
  limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0

interface PaymentRecord {
  id: string
  amount: number
  paymentMethod: string
  notes?: string
  createdAt: string
}

// ─── Componente principal ─────────────────────────────────────────────────────

const FiadosPage: React.FC = () => {
  const { message } = App.useApp()

  // ── Lista de clientes con crédito ──────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showOnlyDebt, setShowOnlyDebt] = useState(false)

  // ── Totales generales ──────────────────────────────────────────────────────
  const [totalDebt, setTotalDebt] = useState(0)
  const [debtorCount, setDebtorCount] = useState(0)

  // ── Modal historial de pagos ───────────────────────────────────────────────
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Modal registrar abono ──────────────────────────────────────────────────
  const [paymentForm] = Form.useForm()
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<Customer | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  // ── Cargar clientes ────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage - 1,
          size: pageSize,
          active: true,
        }
        if (search) params.search = search
        const res = await customerService.getAll(params)
        const content: Customer[] = res.data.content ?? []

        // Filtra solo los que tienen límite de crédito habilitado (creditLimit > 0)
        // o los que tienen deuda activa
        const creditCustomers = showOnlyDebt
          ? content.filter((c) => c.creditUsed > 0)
          : content.filter((c) => c.creditLimit > 0 || c.creditUsed > 0)

        setCustomers(creditCustomers)
        setTotal(res.data.totalElements ?? 0)
      } catch {
        message.error('Error al cargar los clientes')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, search, showOnlyDebt],
  )

  const fetchDebtTotals = useCallback(async () => {
    try {
      const res = await customerService.getDebtors()
      const debtors = res.data ?? []
      setDebtorCount(debtors.length)
      setTotalDebt(debtors.reduce((acc, d) => acc + d.creditUsed, 0))
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchCustomers(1)
  }, [search, showOnlyDebt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCustomers(page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDebtTotals()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ver historial de pagos ─────────────────────────────────────────────────

  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(customer)
    setHistoryModalOpen(true)
    setHistoryLoading(true)
    try {
      const res = await apiClient.get<{ content: PaymentRecord[] }>(
        `/customers/${customer.id}/payments`,
      )
      setPaymentHistory(res.data.content ?? [])
    } catch {
      message.error('Error al cargar el historial de pagos')
    } finally {
      setHistoryLoading(false)
    }
  }

  // ── Registrar abono ────────────────────────────────────────────────────────

  const openPayment = (customer: Customer) => {
    setPaymentTarget(customer)
    paymentForm.resetFields()
    paymentForm.setFieldValue('paymentMethod', 'EFECTIVO')
    setPaymentModalOpen(true)
  }

  const handlePaymentSubmit = async () => {
    let values: Record<string, unknown>
    try {
      values = await paymentForm.validateFields()
    } catch {
      return
    }
    if (!paymentTarget) return
    setPaymentSubmitting(true)
    try {
      await customerService.registerPayment(paymentTarget.id, {
        amount: values.amount as number,
        paymentMethod: values.paymentMethod as string,
        notes: (values.notes as string) || undefined,
      })
      message.success(`Abono de ${fmt(values.amount as number)} registrado para ${paymentTarget.fullName}`)
      setPaymentModalOpen(false)
      paymentForm.resetFields()
      // Refresca datos
      fetchCustomers(page)
      fetchDebtTotals()
      // Si el historial está abierto para este cliente, lo recarga
      if (historyCustomer?.id === paymentTarget.id) {
        openHistory(paymentTarget)
      }
    } catch {
      message.error('Error al registrar el abono')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  // ── Columnas de la tabla ───────────────────────────────────────────────────

  const columns: ColumnsType<Customer> = [
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_: unknown, r: Customer) => (
        <div>
          <Text strong>{r.fullName}</Text>
          {r.rut && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.rut}
              </Text>
            </div>
          )}
          {r.phone && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.phone}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Deuda Actual',
      dataIndex: 'creditUsed',
      key: 'creditUsed',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.creditUsed - b.creditUsed,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a', fontSize: 15 }}>
          {fmt(v)}
        </Text>
      ),
    },
    {
      title: 'Límite',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      align: 'right',
      width: 120,
      render: (v: number) =>
        v === 0 ? (
          <Text type="secondary">Sin límite</Text>
        ) : (
          <Text>{fmt(v)}</Text>
        ),
    },
    {
      title: 'Uso del crédito',
      key: 'creditBar',
      width: 160,
      render: (_: unknown, r: Customer) => {
        if (r.creditLimit === 0) {
          return r.creditUsed > 0 ? (
            <Tag color="orange">Deuda sin límite</Tag>
          ) : (
            <Tag color="default">Sin crédito</Tag>
          )
        }
        const pct = creditPercent(r.creditUsed, r.creditLimit)
        const status = pct >= 100 ? 'exception' : pct >= 80 ? 'active' : 'success'
        return (
          <div style={{ minWidth: 120 }}>
            <Progress percent={pct} size="small" status={status} />
          </div>
        )
      },
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 110,
      render: (_: unknown, r: Customer) => {
        if (r.creditUsed <= 0) return <Badge status="success" text="Al día" />
        const pct = creditPercent(r.creditUsed, r.creditLimit)
        if (r.creditLimit > 0 && pct >= 100)
          return <Badge status="error" text="Límite alcanzado" />
        return <Badge status="warning" text="Con deuda" />
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, r: Customer) => (
        <Space size="small">
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => openHistory(r)}
          >
            Historial
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DollarOutlined />}
            onClick={() => openPayment(r)}
            disabled={r.creditUsed <= 0}
          >
            Abono
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Créditos"
        subtitle="Gestión de créditos por cliente — deudas y abonos"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Créditos' }]}
        extra={
          <Button
            type={showOnlyDebt ? 'primary' : 'default'}
            danger={showOnlyDebt}
            onClick={() => setShowOnlyDebt(!showOnlyDebt)}
          >
            {showOnlyDebt ? 'Ver todos' : 'Solo con deuda'}
          </Button>
        }
      />

      {/* Tarjetas resumen */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic
              title="Deuda Total Pendiente"
              value={totalDebt}
              prefix="$"
              formatter={(v) => Math.round(Number(v)).toLocaleString('es-CL')}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic
              title="Clientes con Deuda"
              value={debtorCount}
              suffix="clientes"
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic
              title="Clientes con Crédito Habilitado"
              value={customers.length}
              suffix="clientes"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card variant="borderless" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Buscar por nombre, RUT o email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={() => setSearch(searchInput)}
              allowClear
              onClear={() => { setSearch(''); setSearchInput('') }}
            />
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => setSearch(searchInput)}
              >
                Buscar
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  setShowOnlyDebt(false)
                }}
              >
                Limpiar
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabla de clientes con crédito */}
      <Card variant="borderless">
        <Table
          rowKey="id"
          dataSource={customers}
          columns={columns}
          loading={loading}
          scroll={{ x: 900 }}
          rowClassName={(r) =>
            r.creditUsed > 0
              ? r.creditLimit > 0 && creditPercent(r.creditUsed, r.creditLimit) >= 100
                ? 'ant-table-row-danger'
                : 'ant-table-row-warning'
              : ''
          }
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `${t} clientes`,
            onChange: setPage,
          }}
        />
      </Card>

      {/* ── Modal: Historial de pagos ──────────────────────────────────────── */}
      <Modal
        title={
          historyCustomer && (
            <Space>
              <HistoryOutlined />
              <span>Historial de crédito — {historyCustomer.fullName}</span>
            </Space>
          )
        }
        open={historyModalOpen}
        onCancel={() => {
          setHistoryModalOpen(false)
          setHistoryCustomer(null)
          setPaymentHistory([])
        }}
        footer={[
          <Button key="close" onClick={() => setHistoryModalOpen(false)}>
            Cerrar
          </Button>,
          historyCustomer && historyCustomer.creditUsed > 0 && (
            <Button
              key="pay"
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => {
                setHistoryModalOpen(false)
                openPayment(historyCustomer)
              }}
            >
              Registrar Abono
            </Button>
          ),
        ]}
        width={560}
      >
        {historyCustomer && (
          <>
            {/* Resumen del cliente */}
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="RUT">
                {historyCustomer.rut ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Teléfono">
                {historyCustomer.phone ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Deuda actual">
                <Text strong style={{ color: historyCustomer.creditUsed > 0 ? '#cf1322' : '#52c41a' }}>
                  {fmt(historyCustomer.creditUsed)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Límite">
                {historyCustomer.creditLimit === 0
                  ? 'Sin límite definido'
                  : fmt(historyCustomer.creditLimit)}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" plain>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Últimos abonos registrados
              </Text>
            </Divider>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>Cargando...</div>
            ) : paymentHistory.length === 0 ? (
              <Empty
                description="Sin abonos registrados"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                rowKey="id"
                dataSource={paymentHistory}
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'Fecha',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
                  },
                  {
                    title: 'Monto',
                    dataIndex: 'amount',
                    key: 'amount',
                    align: 'right',
                    render: (v: number) => (
                      <Text strong style={{ color: '#52c41a' }}>
                        {fmt(v)}
                      </Text>
                    ),
                  },
                  {
                    title: 'Método',
                    dataIndex: 'paymentMethod',
                    key: 'paymentMethod',
                    render: (v: string) => {
                      const labels: Record<string, string> = {
                        EFECTIVO: 'Efectivo',
                        TARJETA: 'Tarjeta',
                        TRANSFERENCIA: 'Transferencia',
                      }
                      return labels[v] ?? v
                    },
                  },
                  {
                    title: 'Notas',
                    dataIndex: 'notes',
                    key: 'notes',
                    render: (v?: string) => v ?? '—',
                  },
                ]}
              />
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Registrar abono ─────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <DollarOutlined />
            Registrar Abono
            {paymentTarget && (
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                — {paymentTarget.fullName}
              </Text>
            )}
          </Space>
        }
        open={paymentModalOpen}
        onCancel={() => {
          setPaymentModalOpen(false)
          paymentForm.resetFields()
          setPaymentTarget(null)
        }}
        onOk={handlePaymentSubmit}
        okText="Registrar Abono"
        cancelText="Cancelar"
        confirmLoading={paymentSubmitting}
        width={440}
      >
        {paymentTarget && (
          <>
            <Card
              size="small"
              variant="borderless"
              style={{ background: '#fff7e6', marginBottom: 16 }}
            >
              <Row justify="space-between">
                <Col>
                  <Text type="secondary">Cliente:</Text>
                  <div>
                    <Text strong>{paymentTarget.fullName}</Text>
                    {paymentTarget.rut && (
                      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        {paymentTarget.rut}
                      </Text>
                    )}
                  </div>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Text type="secondary">Deuda actual:</Text>
                  <div>
                    <Text strong style={{ color: '#cf1322', fontSize: 18 }}>
                      {fmt(paymentTarget.creditUsed)}
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>

            <Form form={paymentForm} layout="vertical">
              <Form.Item
                name="amount"
                label="Monto del abono"
                rules={[
                  { required: true, message: 'Ingresa el monto' },
                  {
                    validator: (_, v) =>
                      v > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error('El monto debe ser mayor a 0')),
                  },
                ]}
              >
                <InputNumber
                  prefix="$"
                  style={{ width: '100%' }}
                  min={1}
                  max={paymentTarget.creditUsed}
                  step={1000}
                  precision={0}
                  placeholder="0"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                name="paymentMethod"
                label="Método de pago"
                rules={[{ required: true, message: 'Selecciona el método' }]}
                initialValue="EFECTIVO"
              >
                <Select
                  size="large"
                  options={[
                    { value: 'EFECTIVO', label: '💵 Efectivo' },
                    { value: 'TARJETA', label: '💳 Tarjeta' },
                    { value: 'TRANSFERENCIA', label: '🏦 Transferencia' },
                  ]}
                />
              </Form.Item>

              <Form.Item name="notes" label="Observaciones (opcional)">
                <TextArea rows={2} placeholder="Ej: Abono parcial de la deuda del mes" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}

export default FiadosPage
