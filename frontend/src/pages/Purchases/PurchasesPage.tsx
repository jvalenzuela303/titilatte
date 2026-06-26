import React, { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Space,
  Select,
  DatePicker,
  Modal,
  Typography,
  Descriptions,
  Row,
  Col,
  Card,
  Tooltip,
  App,
  Form,
  Input,
  InputNumber,
  Progress,
  Divider,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { purchaseService } from '@/services/purchaseService'
import type { Purchase, PurchaseItem, PurchasePayment } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import PurchaseForm from './PurchaseForm'

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input

const statusColor: Record<Purchase['status'], string> = {
  DRAFT: 'default',
  CONFIRMED: 'success',
  CANCELLED: 'error',
}
const statusLabel: Record<Purchase['status'], string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
}
const docTypeLabel: Record<Purchase['documentType'], string> = {
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  SIN_DOCUMENTO: 'Sin Doc.',
}
const payStatusColor: Record<string, string> = {
  UNPAID: 'error',
  PARTIAL: 'warning',
  PAID: 'success',
}
const payStatusLabel: Record<string, string> = {
  UNPAID: 'Sin pagar',
  PARTIAL: 'Parcial',
  PAID: 'Pagado',
}
const methodLabel: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
}

const fmt = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const PurchasesPage: React.FC = () => {
  const { hasRole } = useAuth()
  const canConfirm = hasRole('ADMIN', 'SUPERVISOR')
  const { message } = App.useApp()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null)

  // ── Historial de abonos ──────────────────────────────────────────────────
  const [historyPurchase, setHistoryPurchase] = useState<Purchase | null>(null)
  const [payments, setPayments] = useState<PurchasePayment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Modal registrar abono ────────────────────────────────────────────────
  const [paymentForm] = Form.useForm()
  const [paymentTarget, setPaymentTarget] = useState<Purchase | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  const fetchPurchases = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage - 1,
          size: pageSize,
          sort: 'createdAt,desc',
        }
        if (statusFilter) params.status = statusFilter
        if (dateRange) {
          params.startDate = dateRange[0].format('YYYY-MM-DD')
          params.endDate = dateRange[1].format('YYYY-MM-DD')
        }
        const res = await purchaseService.getAll(params)
        setPurchases(res.data.content)
        setTotal(res.data.totalElements)
      } catch {
        message.error('Error al cargar las compras')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, statusFilter, dateRange],
  )

  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    } else {
      fetchPurchases(1)
    }
  }, [statusFilter, dateRange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPurchases(page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirmar compra ───────────────────────────────────────────────────
  const handleConfirm = (record: Purchase) => {
    Modal.confirm({
      title: 'Confirmar Compra',
      icon: <ExclamationCircleOutlined />,
      content: `¿Confirmar la compra N° ${record.purchaseNumber}? Esto actualizará el stock.`,
      okText: 'Confirmar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await purchaseService.confirm(record.id)
          message.success('Compra confirmada')
          fetchPurchases(page)
        } catch {
          message.error('Error al confirmar la compra')
        }
      },
    })
  }

  // ── Ver detalle ────────────────────────────────────────────────────────
  const handleViewDetail = async (record: Purchase) => {
    try {
      const res = await purchaseService.getById(record.id)
      setDetailPurchase(res.data)
    } catch {
      message.error('Error al cargar el detalle')
    }
  }

  // ── Historial de abonos ────────────────────────────────────────────────
  const openHistory = async (record: Purchase) => {
    setHistoryPurchase(record)
    setHistoryLoading(true)
    try {
      const res = await purchaseService.getPayments(record.id)
      setPayments(res.data)
    } catch {
      message.error('Error al cargar los abonos')
    } finally {
      setHistoryLoading(false)
    }
  }

  // ── Registrar abono ────────────────────────────────────────────────────
  const openPaymentModal = (record: Purchase) => {
    setPaymentTarget(record)
    paymentForm.resetFields()
    paymentForm.setFieldValue('paymentMethod', 'EFECTIVO')
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
      await purchaseService.registerPayment(paymentTarget.id, {
        amount: values.amount as number,
        paymentMethod: values.paymentMethod as string,
        notes: (values.notes as string) || undefined,
      })
      message.success(`Abono de ${fmt(values.amount as number)} registrado`)
      setPaymentTarget(null)
      paymentForm.resetFields()
      fetchPurchases(page)
      // Refresca historial si está abierto para la misma compra
      if (historyPurchase?.id === paymentTarget.id) {
        openHistory({ ...paymentTarget, amountPaid: (paymentTarget.amountPaid ?? 0) + (values.amount as number) } as Purchase)
      }
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Error al registrar el abono'
      message.error(msg)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  // ── Columnas de items ──────────────────────────────────────────────────
  const itemColumns: ColumnsType<PurchaseItem> = [
    { title: 'Producto', dataIndex: 'productName', key: 'productName' },
    { title: 'Cantidad', dataIndex: 'quantity', key: 'quantity', align: 'right' },
    {
      title: 'Costo Unit.',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right',
      render: (v: number) => fmt(v),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      align: 'right',
      render: (v: number) => fmt(v),
    },
  ]

  // ── Columnas principales ───────────────────────────────────────────────
  const columns: ColumnsType<Purchase> = [
    {
      title: 'N° Compra',
      dataIndex: 'purchaseNumber',
      key: 'purchaseNumber',
      width: 100,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Proveedor',
      dataIndex: 'supplierName',
      key: 'supplierName',
      render: (v?: string) => v ?? <Text type="secondary">Sin proveedor</Text>,
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 120,
      render: (v: number) => <Text strong>{fmt(v)}</Text>,
    },
    {
      title: 'Pago',
      key: 'payment',
      width: 160,
      render: (_: unknown, r: Purchase) => {
        if (r.status !== 'CONFIRMED') return <Text type="secondary">—</Text>
        const paid = r.amountPaid ?? 0
        const total = r.totalAmount ?? 0
        const pct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0
        return (
          <div style={{ minWidth: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Tag color={payStatusColor[r.paymentStatus ?? 'UNPAID']} style={{ margin: 0 }}>
                {payStatusLabel[r.paymentStatus ?? 'UNPAID']}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>{fmt(paid)}</Text>
            </div>
            <Progress percent={pct} size="small" showInfo={false}
              strokeColor={pct >= 100 ? '#52c41a' : pct > 0 ? '#faad14' : '#ff4d4f'} />
          </div>
        )
      },
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: Purchase['status']) => (
        <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, record: Purchase) => (
        <Space size="small">
          {canConfirm && record.status === 'DRAFT' && (
            <Tooltip title="Confirmar compra">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)} />
            </Tooltip>
          )}
          {record.status === 'CONFIRMED' && (record.paymentStatus ?? 'UNPAID') !== 'PAID' && (
            <Tooltip title="Registrar abono">
              <Button size="small" icon={<DollarOutlined />}
                onClick={() => openPaymentModal(record)} />
            </Tooltip>
          )}
          {record.status === 'CONFIRMED' && (
            <Tooltip title="Historial de abonos">
              <Button size="small" icon={<HistoryOutlined />}
                onClick={() => openHistory(record)} />
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Compras</Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
            Nueva Compra
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Filtrar por estado"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'DRAFT', label: 'Borrador' },
              { value: 'CONFIRMED', label: 'Confirmado' },
              { value: 'CANCELLED', label: 'Cancelado' },
            ]}
          />
          <RangePicker
            format="DD/MM/YYYY"
            value={dateRange}
            onChange={(vals) => setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={purchases}
          columns={columns}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} compras`,
            onChange: setPage,
          }}
          scroll={{ x: 950 }}
        />
      </Card>

      {/* ── Modal: Nueva Compra ── */}
      <PurchaseForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => { setFormOpen(false); fetchPurchases(page) }}
      />

      {/* ── Modal: Detalle de Compra ── */}
      <Modal
        title={detailPurchase ? `Compra #${detailPurchase.purchaseNumber}` : 'Detalle'}
        open={!!detailPurchase}
        onCancel={() => setDetailPurchase(null)}
        footer={<Button onClick={() => setDetailPurchase(null)}>Cerrar</Button>}
        width={780}
      >
        {detailPurchase && (
          <>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label="Proveedor">{detailPurchase.supplierName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Tipo Documento">{docTypeLabel[detailPurchase.documentType]}</Descriptions.Item>
              <Descriptions.Item label="N° Documento">{detailPurchase.documentNumber ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={statusColor[detailPurchase.status]}>{statusLabel[detailPurchase.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Fecha Compra">{dayjs(detailPurchase.purchaseDate).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Monto Total">
                <Text strong>{fmt(detailPurchase.totalAmount)}</Text>
              </Descriptions.Item>
              {detailPurchase.status === 'CONFIRMED' && (
                <>
                  <Descriptions.Item label="Pagado">
                    <Text strong style={{ color: '#52c41a' }}>{fmt(detailPurchase.amountPaid ?? 0)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Pendiente">
                    <Text strong style={{ color: (detailPurchase.pendingAmount ?? 0) > 0 ? '#cf1322' : '#52c41a' }}>
                      {fmt(detailPurchase.pendingAmount ?? 0)}
                    </Text>
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="Registrado por" span={2}>{detailPurchase.purchasedByEmail}</Descriptions.Item>
              {detailPurchase.notes && (
                <Descriptions.Item label="Notas" span={2}>{detailPurchase.notes}</Descriptions.Item>
              )}
            </Descriptions>
            <Title level={5} style={{ marginTop: 20 }}>Productos</Title>
            <Table rowKey="id" dataSource={detailPurchase.items} columns={itemColumns}
              pagination={false} size="small" scroll={{ x: 500 }} />
          </>
        )}
      </Modal>

      {/* ── Modal: Historial de abonos ── */}
      <Modal
        title={historyPurchase ? `Abonos — Compra #${historyPurchase.purchaseNumber}` : 'Historial'}
        open={!!historyPurchase}
        onCancel={() => { setHistoryPurchase(null); setPayments([]) }}
        footer={[
          <Button key="close" onClick={() => { setHistoryPurchase(null); setPayments([]) }}>Cerrar</Button>,
          historyPurchase && (historyPurchase.paymentStatus ?? 'UNPAID') !== 'PAID' && (
            <Button key="pay" type="primary" icon={<DollarOutlined />}
              onClick={() => { setHistoryPurchase(null); openPaymentModal(historyPurchase) }}>
              Registrar Abono
            </Button>
          ),
        ]}
        width={560}
      >
        {historyPurchase && (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Total">{fmt(historyPurchase.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Estado pago">
                <Tag color={payStatusColor[historyPurchase.paymentStatus ?? 'UNPAID']}>
                  {payStatusLabel[historyPurchase.paymentStatus ?? 'UNPAID']}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Pagado">
                <Text style={{ color: '#52c41a' }}>{fmt(historyPurchase.amountPaid ?? 0)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Pendiente">
                <Text style={{ color: (historyPurchase.pendingAmount ?? 0) > 0 ? '#cf1322' : '#52c41a' }}>
                  {fmt(historyPurchase.pendingAmount ?? 0)}
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
              <Table
                rowKey="id"
                dataSource={payments}
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'Fecha',
                    dataIndex: 'paidAt',
                    key: 'paidAt',
                    render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
                  },
                  {
                    title: 'Monto',
                    dataIndex: 'amount',
                    key: 'amount',
                    align: 'right',
                    render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text>,
                  },
                  {
                    title: 'Método',
                    dataIndex: 'paymentMethod',
                    key: 'paymentMethod',
                    render: (v: string) => methodLabel[v] ?? v,
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

      {/* ── Modal: Registrar abono ── */}
      <Modal
        title={paymentTarget ? `Abonar — Compra #${paymentTarget.purchaseNumber}` : 'Abono'}
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
                  <Text type="secondary">Proveedor</Text>
                  <div><Text strong>{paymentTarget.supplierName ?? 'Sin proveedor'}</Text></div>
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
              <Form.Item
                name="amount"
                label="Monto del abono"
                rules={[
                  { required: true, message: 'Ingresa el monto' },
                  {
                    validator: (_, v) =>
                      v > 0 ? Promise.resolve() : Promise.reject(new Error('Debe ser mayor a 0')),
                  },
                ]}
              >
                <InputNumber
                  prefix="$"
                  style={{ width: '100%' }}
                  min={1}
                  max={paymentTarget.pendingAmount ?? paymentTarget.totalAmount}
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
                    { value: 'EFECTIVO', label: 'Efectivo' },
                    { value: 'TRANSFERENCIA', label: 'Transferencia' },
                    { value: 'CHEQUE', label: 'Cheque' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="notes" label="Notas (opcional)">
                <TextArea rows={2} placeholder="Ej: Abono parcial, pago con transferencia" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}

export default PurchasesPage
