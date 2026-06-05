import React, { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Progress,
  Typography,
  Card,
  Row,
  Col,
  Tooltip,
  Divider,
  Alert,
  App,
} from 'antd'
import {
  PlusOutlined,
  DollarOutlined,
  EditOutlined,
  UserOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { customerService } from '@/services/customerService'
import type { Customer } from '@/types'
import { useAuth } from '@/hooks/useAuth'

const { Title, Text } = Typography
const { TextArea } = Input

// ── Helpers ──────────────────────────────────────────────────────────────────

const creditPercent = (used: number, limit: number) =>
  limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0

const rowBackground = (record: Customer): React.CSSProperties => {
  const pct = creditPercent(record.creditUsed, record.creditLimit)
  if (pct >= 100) return { background: '#fff1f0' }
  if (pct >= 80) return { background: '#fff7e6' }
  return {}
}

const fmt = (v: number) =>
  `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}`

// ── Component ─────────────────────────────────────────────────────────────────

const CustomersPage: React.FC = () => {
  const { hasRole } = useAuth()
  const canEditLimit = hasRole('ADMIN', 'SUPERVISOR')

  const { message } = App.useApp()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('true')

  // Modals state
  const [customerForm] = Form.useForm()
  const [paymentForm] = Form.useForm()
  const [creditLimitForm] = Form.useForm()

  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerSubmitting, setCustomerSubmitting] = useState(false)

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<Customer | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  const [creditLimitModalOpen, setCreditLimitModalOpen] = useState(false)
  const [creditLimitTarget, setCreditLimitTarget] = useState<Customer | null>(null)
  const [creditLimitSubmitting, setCreditLimitSubmitting] = useState(false)

  const fetchCustomers = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage - 1,
          size: pageSize,
        }
        if (search) params.search = search
        if (activeFilter !== 'all') params.active = activeFilter
        const res = await customerService.getAll(params)
        setCustomers(res.data.content)
        setTotal(res.data.totalElements)
      } catch {
        message.error('Error al cargar los clientes')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, search, activeFilter],
  )

  useEffect(() => {
    setPage(1)
    fetchCustomers(1)
  }, [search, activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCustomers(page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Customer create/edit ──────────────────────────────────────────────────

  const openCustomerModal = (customer?: Customer) => {
    setEditingCustomer(customer ?? null)
    if (customer) {
      customerForm.setFieldsValue({
        firstName: customer.firstName,
        lastName: customer.lastName,
        rut: customer.rut,
        phone: customer.phone,
        email: customer.email,
        creditLimit: customer.creditLimit,
      })
    } else {
      customerForm.resetFields()
    }
    setCustomerModalOpen(true)
  }

  const handleCustomerSubmit = async () => {
    try {
      const values = await customerForm.validateFields()
      setCustomerSubmitting(true)
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, values)
        message.success('Cliente actualizado')
      } else {
        await customerService.create(values)
        message.success('Cliente creado exitosamente')
      }
      setCustomerModalOpen(false)
      customerForm.resetFields()
      fetchCustomers(page)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Error al guardar el cliente')
    } finally {
      setCustomerSubmitting(false)
    }
  }

  // ── Payment ───────────────────────────────────────────────────────────────

  const openPaymentModal = (customer: Customer) => {
    setPaymentTarget(customer)
    paymentForm.resetFields()
    setPaymentModalOpen(true)
  }

  const handlePaymentSubmit = async () => {
    try {
      const values = await paymentForm.validateFields()
      if (!paymentTarget) return
      setPaymentSubmitting(true)
      await customerService.registerPayment(paymentTarget.id, {
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
      })
      message.success('Pago registrado exitosamente')
      setPaymentModalOpen(false)
      paymentForm.resetFields()
      setPaymentTarget(null)
      fetchCustomers(page)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Error al registrar el pago')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  // ── Credit limit ──────────────────────────────────────────────────────────

  const openCreditLimitModal = (customer: Customer) => {
    setCreditLimitTarget(customer)
    creditLimitForm.setFieldsValue({ newLimit: customer.creditLimit })
    setCreditLimitModalOpen(true)
  }

  const handleCreditLimitSubmit = async () => {
    try {
      const values = await creditLimitForm.validateFields()
      if (!creditLimitTarget) return
      setCreditLimitSubmitting(true)
      await customerService.updateCreditLimit(creditLimitTarget.id, {
        newLimit: values.newLimit,
        reason: values.reason,
      })
      message.success('Límite de crédito actualizado')
      setCreditLimitModalOpen(false)
      creditLimitForm.resetFields()
      setCreditLimitTarget(null)
      fetchCustomers(page)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Error al actualizar el límite')
    } finally {
      setCreditLimitSubmitting(false)
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: ColumnsType<Customer> = [
    {
      title: 'Nombre',
      key: 'fullName',
      render: (_, r) => (
        <Text strong>
          {r.firstName} {r.lastName}
        </Text>
      ),
    },
    {
      title: 'RUT',
      dataIndex: 'rut',
      key: 'rut',
      width: 120,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Teléfono',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Límite Crédito',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      align: 'right',
      width: 130,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Usado',
      dataIndex: 'creditUsed',
      key: 'creditUsed',
      align: 'right',
      width: 120,
      render: (v: number, record) => {
        const pct = creditPercent(v, record.creditLimit)
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text
              style={{
                color: pct >= 100 ? '#ff4d4f' : pct >= 80 ? '#fa8c16' : undefined,
              }}
            >
              {fmt(v)}
            </Text>
            <Progress
              percent={pct}
              showInfo={false}
              size="small"
              strokeColor={pct >= 100 ? '#ff4d4f' : pct >= 80 ? '#fa8c16' : '#52c41a'}
            />
          </Space>
        )
      },
    },
    {
      title: 'Disponible',
      dataIndex: 'availableCredit',
      key: 'availableCredit',
      align: 'right',
      width: 120,
      render: (v: number) => (
        <Text style={{ color: v <= 0 ? '#ff4d4f' : undefined }}>{fmt(v)}</Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Registrar pago">
            <Button
              size="small"
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => openPaymentModal(record)}
              disabled={record.creditUsed <= 0}
            />
          </Tooltip>
          <Tooltip title="Editar cliente">
            <Button
              size="small"
              icon={<UserOutlined />}
              onClick={() => openCustomerModal(record)}
            />
          </Tooltip>
          {canEditLimit && (
            <Tooltip title="Ajustar límite crédito">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openCreditLimitModal(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Clientes
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openCustomerModal()}
          >
            Nuevo Cliente
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12} wrap>
          <Col xs={24} sm={14} md={10}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Buscar por nombre o RUT"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10} md={8}>
            <Select
              style={{ width: '100%' }}
              value={activeFilter}
              onChange={setActiveFilter}
              options={[
                { value: 'true', label: 'Solo Activos' },
                { value: 'false', label: 'Solo Inactivos' },
                { value: 'all', label: 'Todos' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={customers}
          columns={columns}
          loading={loading}
          onRow={(record) => ({ style: rowBackground(record) })}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} clientes`,
            onChange: setPage,
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Modal Nuevo/Editar Cliente */}
      <Modal
        title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
        open={customerModalOpen}
        onCancel={() => {
          setCustomerModalOpen(false)
          customerForm.resetFields()
          setEditingCustomer(null)
        }}
        onOk={handleCustomerSubmit}
        okText={editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
        cancelText="Cancelar"
        confirmLoading={customerSubmitting}
        forceRender
      >
        <Form form={customerForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="Nombre"
                rules={[{ required: true, message: 'El nombre es requerido' }]}
              >
                <Input placeholder="Nombre" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Apellido"
                rules={[{ required: true, message: 'El apellido es requerido' }]}
              >
                <Input placeholder="Apellido" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rut" label="RUT">
                <Input placeholder="Ej: 12.345.678-9" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Teléfono">
                <Input placeholder="Ej: +56912345678" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="correo@ejemplo.com" />
          </Form.Item>
          {/* SECURITY: credit limit is intentionally absent from the creation form.
              The backend always initializes it to $0 on creation regardless of the
              submitted value. Only ADMIN/SUPERVISOR can set it via the dedicated
              "Ajustar límite" action, which calls PATCH /customers/{id}/credit-limit. */}
        </Form>
      </Modal>

      {/* Modal Registrar Pago */}
      <Modal
        title="Registrar Pago"
        open={paymentModalOpen}
        onCancel={() => {
          setPaymentModalOpen(false)
          paymentForm.resetFields()
          setPaymentTarget(null)
        }}
        onOk={handlePaymentSubmit}
        okText="Registrar Pago"
        cancelText="Cancelar"
        confirmLoading={paymentSubmitting}
        forceRender
      >
        {paymentTarget && (
          <>
            <Alert
              message={
                <Space direction="vertical" size={2}>
                  <Text>
                    Cliente: <Text strong>{paymentTarget.firstName} {paymentTarget.lastName}</Text>
                  </Text>
                  <Text>
                    Deuda actual: <Text strong style={{ color: '#ff4d4f' }}>{fmt(paymentTarget.creditUsed)}</Text>
                  </Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form form={paymentForm} layout="vertical">
              <Form.Item
                name="amount"
                label="Monto del Pago ($)"
                rules={[
                  { required: true, message: 'Ingresa el monto' },
                  { type: 'number', min: 1, message: 'Debe ser mayor a 0' },
                  {
                    type: 'number',
                    max: paymentTarget.creditUsed,
                    message: `El monto no puede superar la deuda (${fmt(paymentTarget.creditUsed)})`,
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={paymentTarget.creditUsed}
                  prefix="$"
                  placeholder={`Máximo: ${fmt(paymentTarget.creditUsed)}`}
                />
              </Form.Item>
              <Form.Item
                name="paymentMethod"
                label="Método de Pago"
                rules={[{ required: true, message: 'Selecciona el método de pago' }]}
              >
                <Select
                  placeholder="Seleccionar"
                  options={[
                    { value: 'EFECTIVO', label: 'Efectivo' },
                    { value: 'TRANSFERENCIA', label: 'Transferencia' },
                    { value: 'TARJETA', label: 'Tarjeta' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="notes" label="Notas (opcional)">
                <TextArea rows={2} placeholder="Observaciones del pago" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Modal Editar Límite Crédito */}
      <Modal
        title="Ajustar Límite de Crédito"
        open={creditLimitModalOpen}
        onCancel={() => {
          setCreditLimitModalOpen(false)
          creditLimitForm.resetFields()
          setCreditLimitTarget(null)
        }}
        onOk={handleCreditLimitSubmit}
        okText="Actualizar Límite"
        cancelText="Cancelar"
        confirmLoading={creditLimitSubmitting}
        forceRender
      >
        {creditLimitTarget && (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Cliente: <Text strong>{creditLimitTarget.firstName} {creditLimitTarget.lastName}</Text>
              <br />
              Límite actual: <Text strong>{fmt(creditLimitTarget.creditLimit)}</Text>
            </Text>
            <Divider />
            <Form form={creditLimitForm} layout="vertical">
              <Form.Item
                name="newLimit"
                label="Nuevo Límite ($)"
                rules={[
                  { required: true, message: 'Ingresa el nuevo límite' },
                  { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
              </Form.Item>
              <Form.Item
                name="reason"
                label="Motivo del cambio"
                rules={[{ required: true, message: 'Indica el motivo del cambio' }]}
              >
                <TextArea rows={2} placeholder="Razón del ajuste de límite" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}

export default CustomersPage
