import React, { useEffect, useState, useCallback } from 'react'
import {
  Table, Button, Tag, Space, Select, Modal, Form, Input, InputNumber,
  Typography, Card, Row, Col, App, Tooltip, Descriptions, Divider,
  Empty, DatePicker, Badge, Statistic,
} from 'antd'
import {
  PlusOutlined, DollarOutlined, HistoryOutlined, EditOutlined,
  SearchOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { orderService } from '@/services/orderService'
import { customerService } from '@/services/customerService'
import type { Order, OrderPayment, Customer } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import PageHeader from '@/components/common/PageHeader'

const { Text, Title } = Typography
const { TextArea } = Input

const fmt = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  READY: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En preparación',
  READY: 'Listo para retirar',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}
const PAY_COLOR: Record<string, string> = {
  UNPAID: 'error',
  PARTIAL: 'warning',
  PAID: 'success',
}
const PAY_LABEL: Record<string, string> = {
  UNPAID: 'Sin pagar',
  PARTIAL: 'Parcial',
  PAID: 'Pagado',
}
const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
}

const ACTIVE_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY']

const OrdersPage: React.FC = () => {
  const { hasRole } = useAuth()
  const canChangeStatus = hasRole('ADMIN', 'SUPERVISOR')
  const { message } = App.useApp()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  // ── Crear pedido ──────────────────────────────────────────────────────────
  const [createForm] = Form.useForm()
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const [statusTarget, setStatusTarget] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState<string>('')
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  // ── Historial de abonos ───────────────────────────────────────────────────
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null)
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Registrar abono ───────────────────────────────────────────────────────
  const [paymentForm] = Form.useForm()
  const [paymentTarget, setPaymentTarget] = useState<Order | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  // ── Carga de pedidos ──────────────────────────────────────────────────────
  const fetchOrders = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = { page: currentPage - 1, size: pageSize }
        if (statusFilter) params.status = statusFilter
        const res = await orderService.getAll(params)
        setOrders(res.data.content)
        setTotal(res.data.totalElements)
      } catch {
        message.error('Error al cargar los pedidos')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, statusFilter],
  )

  useEffect(() => { setPage(1); fetchOrders(1) }, [statusFilter]) // eslint-disable-line
  useEffect(() => { fetchOrders(page) }, [page]) // eslint-disable-line

  // ── Resumen rápido ────────────────────────────────────────────────────────
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
  const readyOrders  = orders.filter((o) => o.status === 'READY')
  const pendingDebt  = orders.reduce((s, o) => s + (o.pendingAmount ?? 0), 0)

  // ── Buscar cliente existente ──────────────────────────────────────────────
  const handleCustomerSearch = async (value: string) => {
    if (!value.trim()) { setCustomerOptions([]); return }
    setCustomerSearching(true)
    try {
      const res = await customerService.getAll({ search: value, size: 8, active: true })
      setCustomerOptions(res.data.content ?? [])
    } catch { /* silencioso */ }
    finally { setCustomerSearching(false) }
  }

  // ── Crear pedido ──────────────────────────────────────────────────────────
  const handleCreateSubmit = async () => {
    let values: Record<string, unknown>
    try { values = await createForm.validateFields() } catch { return }
    setCreateSubmitting(true)
    try {
      await orderService.create({
        customerName: values.customerName as string,
        customerPhone: (values.customerPhone as string) || undefined,
        customerId: (values.customerId as string) || undefined,
        description: values.description as string,
        totalAmount: values.totalAmount as number,
        deliveryDate: (values.deliveryDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        notes: (values.notes as string) || undefined,
      })
      message.success('Pedido creado exitosamente')
      setCreateOpen(false)
      createForm.resetFields()
      setCustomerOptions([])
      fetchOrders(1)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Error al crear el pedido'
      message.error(msg)
    } finally { setCreateSubmitting(false) }
  }

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const openStatusModal = (order: Order) => {
    setStatusTarget(order)
    setNewStatus(order.status)
  }

  const handleStatusSubmit = async () => {
    if (!statusTarget || !newStatus) return
    setStatusSubmitting(true)
    try {
      await orderService.updateStatus(statusTarget.id, newStatus)
      message.success('Estado actualizado')
      setStatusTarget(null)
      fetchOrders(page)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Error al actualizar el estado'
      message.error(msg)
    } finally { setStatusSubmitting(false) }
  }

  // ── Historial de abonos ───────────────────────────────────────────────────
  const openHistory = async (order: Order) => {
    setHistoryOrder(order)
    setHistoryLoading(true)
    try {
      const res = await orderService.getPayments(order.id)
      setPayments(res.data)
    } catch { message.error('Error al cargar los abonos') }
    finally { setHistoryLoading(false) }
  }

  // ── Registrar abono ───────────────────────────────────────────────────────
  const openPayment = (order: Order) => {
    setPaymentTarget(order)
    paymentForm.resetFields()
    paymentForm.setFieldValue('paymentMethod', 'EFECTIVO')
  }

  const handlePaymentSubmit = async () => {
    let values: Record<string, unknown>
    try { values = await paymentForm.validateFields() } catch { return }
    if (!paymentTarget) return
    setPaymentSubmitting(true)
    try {
      await orderService.registerPayment(paymentTarget.id, {
        amount: values.amount as number,
        paymentMethod: values.paymentMethod as string,
        notes: (values.notes as string) || undefined,
      })
      message.success(`Abono de ${fmt(values.amount as number)} registrado`)
      setPaymentTarget(null)
      paymentForm.resetFields()
      fetchOrders(page)
      if (historyOrder?.id === paymentTarget.id) openHistory(paymentTarget)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Error al registrar el abono'
      message.error(msg)
    } finally { setPaymentSubmitting(false) }
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columns: ColumnsType<Order> = [
    {
      title: 'N° Pedido',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 90,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_: unknown, r: Order) => (
        <div>
          <Text strong>{r.customerName}</Text>
          {r.customerPhone && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{r.customerPhone}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Entrega',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 100,
      render: (v: string) => {
        const d = dayjs(v)
        const isOverdue = d.isBefore(dayjs(), 'day')
        const isToday   = d.isSame(dayjs(), 'day')
        return (
          <Text style={{ color: isOverdue ? '#cf1322' : isToday ? '#d46b08' : undefined }}
                strong={isToday || isOverdue}>
            {d.format('DD/MM/YYYY')}
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
      render: (v: number) => fmt(v),
    },
    {
      title: 'Abonado',
      key: 'abonado',
      align: 'right',
      width: 110,
      render: (_: unknown, r: Order) => (
        <div>
          <Text style={{ color: '#52c41a' }}>{fmt(r.amountPaid ?? 0)}</Text>
          <div>
            <Tag color={PAY_COLOR[r.paymentStatus]} style={{ margin: 0, fontSize: 11 }}>
              {PAY_LABEL[r.paymentStatus]}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as 'default' | 'processing' | 'error' | 'warning' | 'success'} text={STATUS_LABEL[v]} />,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, r: Order) => (
        <Space size="small">
          {r.paymentStatus !== 'PAID' && r.status !== 'CANCELLED' && (
            <Tooltip title="Registrar abono">
              <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => openPayment(r)} />
            </Tooltip>
          )}
          <Tooltip title="Historial de abonos">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)} />
          </Tooltip>
          {canChangeStatus && r.status !== 'DELIVERED' && r.status !== 'CANCELLED' && (
            <Tooltip title="Cambiar estado">
              <Button size="small" icon={<EditOutlined />} onClick={() => openStatusModal(r)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pedidos Especiales"
        subtitle="Encargos a pedido — tortas, galletas, cocktelería y más"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Pedidos' }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true) }}>
            Nuevo Pedido
          </Button>
        }
      />

      {/* Tarjetas resumen */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic title="Pedidos Activos" value={activeOrders.length}
              suffix="pedidos" valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic title="Listos para Retirar" value={readyOrders.length}
              suffix="pedidos" valueStyle={{ color: '#d46b08' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic title="Saldo Pendiente Total" value={pendingDebt}
              prefix="$" formatter={(v) => Math.round(Number(v)).toLocaleString('es-CL')}
              valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card variant="borderless" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Select
              placeholder="Filtrar por estado"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => { setStatusFilter(undefined); fetchOrders(1) }}>
              Limpiar
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Tabla */}
      <Card variant="borderless">
        <Table
          rowKey="id"
          dataSource={orders}
          columns={columns}
          loading={loading}
          scroll={{ x: 900 }}
          rowClassName={(r) =>
            r.status === 'READY' ? 'ant-table-row-warning' :
            r.status === 'CANCELLED' ? 'ant-table-row-danger' : ''
          }
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `${t} pedidos`,
            onChange: setPage,
          }}
        />
      </Card>

      {/* ── Modal: Nuevo Pedido ── */}
      <Modal
        title={<Space><PlusOutlined />Nuevo Pedido</Space>}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); setCustomerOptions([]) }}
        onOk={handleCreateSubmit}
        okText="Crear Pedido"
        cancelText="Cancelar"
        confirmLoading={createSubmitting}
        width={520}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 8 }}>
          <Divider orientation="left" plain><Text type="secondary" style={{ fontSize: 12 }}>Datos del cliente</Text></Divider>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="customerName" label="Nombre del cliente"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="Ej: María González" autoFocus />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="customerPhone" label="Teléfono">
                <Input placeholder="+56912345678" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="customerId" label="Vincular con cliente del sistema (opcional)">
            <Select
              showSearch
              allowClear
              placeholder="Buscar por nombre o RUT..."
              filterOption={false}
              onSearch={handleCustomerSearch}
              loading={customerSearching}
              notFoundContent={customerSearching ? 'Buscando...' : 'No encontrado'}
              options={customerOptions.map((c) => ({
                value: c.id,
                label: `${c.fullName}${c.rut ? ` — ${c.rut}` : ''}`,
              }))}
              onChange={(id) => {
                const c = customerOptions.find((x) => x.id === id)
                if (c) {
                  createForm.setFieldsValue({ customerName: c.fullName, customerPhone: c.phone ?? '' })
                }
              }}
            />
          </Form.Item>

          <Divider orientation="left" plain><Text type="secondary" style={{ fontSize: 12 }}>Detalle del pedido</Text></Divider>
          <Form.Item name="description" label="Descripción del pedido"
            rules={[{ required: true, message: 'Requerido' }]}>
            <TextArea rows={3} placeholder="Ej: Torta de chocolate 3 pisos, decoración de princesa en colores rosado y blanco, para 20 personas" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="totalAmount" label="Precio total"
                rules={[{ required: true, message: 'Requerido' }]}>
                <InputNumber prefix="$" style={{ width: '100%' }} min={1} step={1000} precision={0} placeholder="0" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deliveryDate" label="Fecha de entrega"
                rules={[{ required: true, message: 'Requerido' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" size="large"
                  disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notas adicionales (opcional)">
            <TextArea rows={2} placeholder="Alergias, instrucciones especiales, etc." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Cambiar Estado ── */}
      <Modal
        title={statusTarget ? `Estado — Pedido #${statusTarget.orderNumber}` : 'Estado'}
        open={!!statusTarget}
        onCancel={() => setStatusTarget(null)}
        onOk={handleStatusSubmit}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={statusSubmitting}
        width={360}
      >
        {statusTarget && (
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item label="Nuevo estado">
              <Select value={newStatus} onChange={setNewStatus} style={{ width: '100%' }} size="large"
                options={Object.entries(STATUS_LABEL)
                  .filter(([v]) => v !== 'CANCELLED' || canChangeStatus)
                  .map(([v, l]) => ({ value: v, label: l }))}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ── Modal: Historial de abonos ── */}
      <Modal
        title={historyOrder ? `Abonos — Pedido #${historyOrder.orderNumber}` : 'Historial'}
        open={!!historyOrder}
        onCancel={() => { setHistoryOrder(null); setPayments([]) }}
        footer={[
          <Button key="close" onClick={() => { setHistoryOrder(null); setPayments([]) }}>Cerrar</Button>,
          historyOrder && historyOrder.paymentStatus !== 'PAID' && historyOrder.status !== 'CANCELLED' && (
            <Button key="pay" type="primary" icon={<DollarOutlined />}
              onClick={() => { setHistoryOrder(null); openPayment(historyOrder) }}>
              Registrar Abono
            </Button>
          ),
        ]}
        width={560}
      >
        {historyOrder && (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Cliente"><Text strong>{historyOrder.customerName}</Text></Descriptions.Item>
              <Descriptions.Item label="Teléfono">{historyOrder.customerPhone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Total">{fmt(historyOrder.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Estado pago">
                <Tag color={PAY_COLOR[historyOrder.paymentStatus]}>{PAY_LABEL[historyOrder.paymentStatus]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Abonado">
                <Text style={{ color: '#52c41a' }}>{fmt(historyOrder.amountPaid ?? 0)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Pendiente">
                <Text style={{ color: (historyOrder.pendingAmount ?? 0) > 0 ? '#cf1322' : '#52c41a' }}>
                  {fmt(historyOrder.pendingAmount ?? 0)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" plain>
              <Text type="secondary" style={{ fontSize: 12 }}>Abonos registrados</Text>
            </Divider>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>Cargando...</div>
            ) : payments.length === 0 ? (
              <Empty description="Sin abonos registrados" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table rowKey="id" dataSource={payments} size="small" pagination={false}
                columns={[
                  { title: 'Fecha', dataIndex: 'paidAt', key: 'paidAt', render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
                  { title: 'Monto', dataIndex: 'amount', key: 'amount', align: 'right' as const,
                    render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text> },
                  { title: 'Método', dataIndex: 'paymentMethod', key: 'paymentMethod', render: (v: string) => METHOD_LABEL[v] ?? v },
                  { title: 'Notas', dataIndex: 'notes', key: 'notes', render: (v?: string) => v ?? '—' },
                ]}
              />
            )}
          </>
        )}
      </Modal>

      {/* ── Modal: Registrar Abono ── */}
      <Modal
        title={paymentTarget ? `Abonar — Pedido #${paymentTarget.orderNumber}` : 'Abono'}
        open={!!paymentTarget}
        onCancel={() => { setPaymentTarget(null); paymentForm.resetFields() }}
        onOk={handlePaymentSubmit}
        okText="Registrar Abono"
        cancelText="Cancelar"
        confirmLoading={paymentSubmitting}
        width={420}
      >
        {paymentTarget && (
          <>
            <Card size="small" style={{ background: '#fff7e6', marginBottom: 16 }}>
              <Row justify="space-between">
                <Col>
                  <Text type="secondary">Cliente</Text>
                  <div><Text strong>{paymentTarget.customerName}</Text></div>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>{paymentTarget.description}</Text></div>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Text type="secondary">Pendiente</Text>
                  <div>
                    <Text strong style={{ color: '#cf1322', fontSize: 18 }}>
                      {fmt(paymentTarget.pendingAmount ?? paymentTarget.totalAmount)}
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>
            <Form form={paymentForm} layout="vertical">
              <Form.Item name="amount" label="Monto del abono"
                rules={[
                  { required: true, message: 'Ingresa el monto' },
                  { validator: (_, v) => v > 0 ? Promise.resolve() : Promise.reject(new Error('Debe ser mayor a 0')) },
                ]}>
                <InputNumber prefix="$" style={{ width: '100%' }} min={1}
                  max={paymentTarget.pendingAmount ?? paymentTarget.totalAmount}
                  step={1000} precision={0} placeholder="0" size="large" autoFocus />
              </Form.Item>
              <Form.Item name="paymentMethod" label="Método de pago" initialValue="EFECTIVO"
                rules={[{ required: true, message: 'Selecciona el método' }]}>
                <Select size="large" options={[
                  { value: 'EFECTIVO', label: 'Efectivo' },
                  { value: 'TRANSFERENCIA', label: 'Transferencia' },
                  { value: 'TARJETA', label: 'Tarjeta' },
                ]} />
              </Form.Item>
              <Form.Item name="notes" label="Notas (opcional)">
                <TextArea rows={2} placeholder="Ej: Abono inicial al encargar" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}

export default OrdersPage
