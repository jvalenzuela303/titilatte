import React, { useEffect, useState, useCallback } from 'react'
import {
  Card,
  Button,
  Form,
  InputNumber,
  Input,
  Select,
  Tabs,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Typography,
  Modal,
  Spin,
  Alert,
  Space,
  Divider,
  App,
} from 'antd'
import {
  WalletOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { cashService } from '@/services/cashService'
import type { CashRegister, CashSummary, CashMovement } from '@/types'

const { Title, Text } = Typography
const { TextArea } = Input

const movementTypeColor: Record<CashMovement['movementType'], string> = {
  INGRESO: 'success',
  EGRESO: 'error',
  VENTA: 'processing',
  PAGO_CREDITO: 'warning',
}

const movementTypeLabel: Record<CashMovement['movementType'], string> = {
  INGRESO: 'Ingreso',
  EGRESO: 'Egreso',
  VENTA: 'Venta',
  PAGO_CREDITO: 'Pago Crédito',
}

const INCOME_CATEGORIES = ['FONDO_CAMBIO', 'INGRESO_MANUAL', 'PAGO_CREDITO', 'OTROS']
const EXPENSE_CATEGORIES = ['RETIRO', 'GASTO_OPERACIONAL', 'DEVOLUCION', 'OTROS']

const CashPage: React.FC = () => {
  const { message } = App.useApp()
  const [loadingRegister, setLoadingRegister] = useState(true)
  const [register, setRegister] = useState<CashRegister | null>(null)
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  const [openForm] = Form.useForm()
  const [movForm] = Form.useForm()
  const [closeForm] = Form.useForm()

  const [openingSubmit, setOpeningSubmit] = useState(false)
  const [movSubmit, setMovSubmit] = useState(false)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closeSubmit, setCloseSubmit] = useState(false)
  const [countedAmount, setCountedAmount] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('movements')
  const [movementType, setMovementType] = useState<'INGRESO' | 'EGRESO'>('INGRESO')

  const fetchCurrent = async () => {
    setLoadingRegister(true)
    try {
      const res = await cashService.getCurrent()
      setRegister(res.status === 200 && res.data ? res.data : null)
    } catch {
      message.error('Error al obtener el estado de caja')
    } finally {
      setLoadingRegister(false)
    }
  }

  const fetchSummary = useCallback(async (id: string) => {
    try {
      const res = await cashService.getSummary(id)
      setSummary(res.data)
    } catch {
      message.error('Error al cargar el resumen de caja')
    }
  }, [])

  const fetchMovements = useCallback(async (id: string) => {
    setMovementsLoading(true)
    try {
      const res = await cashService.getMovements(id)
      setMovements(res.data.content ?? [])
    } catch {
      message.error('Error al cargar los movimientos')
    } finally {
      setMovementsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCurrent()
  }, [])

  useEffect(() => {
    if (register?.id) {
      fetchMovements(register.id)
      fetchSummary(register.id)
    }
  }, [register?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenCash = async () => {
    try {
      const values = await openForm.validateFields()
      setOpeningSubmit(true)
      const res = await cashService.open({
        openingAmount: values.openingAmount,
        notes: values.notes,
      })
      message.success('Caja abierta exitosamente')
      setRegister(res.data)
      openForm.resetFields()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Error al abrir la caja')
    } finally {
      setOpeningSubmit(false)
    }
  }

  const handleAddMovement = async () => {
    try {
      const values = await movForm.validateFields()
      if (!register?.id) return
      setMovSubmit(true)
      await cashService.addMovement(register.id, {
        movementType: values.movementType,
        category: values.category,
        amount: values.amount,
        description: values.description,
      })
      message.success('Movimiento registrado')
      movForm.resetFields()
      setMovementType('INGRESO')
      await fetchMovements(register.id)
      await fetchSummary(register.id)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Error al registrar el movimiento')
    } finally {
      setMovSubmit(false)
    }
  }

  const handleCloseCash = async () => {
    try {
      const values = await closeForm.validateFields()
      if (!register?.id) return
      setCloseSubmit(true)
      await cashService.close(register.id, {
        countedAmount: values.countedAmount,
        notes: values.notes,
      })
      message.success('Caja cerrada exitosamente')
      setRegister(null)
      setSummary(null)
      setMovements([])
      setCloseModalOpen(false)
      closeForm.resetFields()
      setCountedAmount(null)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Error al cerrar la caja')
    } finally {
      setCloseSubmit(false)
    }
  }

  const expectedAmount = summary?.expectedAmount ?? 0
  const difference =
    countedAmount != null ? countedAmount - expectedAmount : null

  const movementColumns: ColumnsType<CashMovement> = [
    {
      title: 'Tipo',
      dataIndex: 'movementType',
      key: 'movementType',
      width: 130,
      render: (v: CashMovement['movementType']) => (
        <Tag color={movementTypeColor[v]}>{movementTypeLabel[v]}</Tag>
      ),
    },
    { title: 'Categoría', dataIndex: 'category', key: 'category' },
    {
      title: 'Monto',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 120,
      render: (v: number, record) => (
        <Text
          strong
          style={{
            color:
              record.movementType === 'EGRESO'
                ? '#ff4d4f'
                : '#52c41a',
          }}
        >
          {record.movementType === 'EGRESO' ? '-' : '+'}$
          {v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
        </Text>
      ),
    },
    { title: 'Descripción', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Hora',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 90,
      render: (v: string) => dayjs(v).format('HH:mm'),
    },
  ]

  if (loadingRegister) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  // ── No hay caja abierta ─────────────────────────────────────────────────────
  if (!register) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <Card
          style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}
          variant="outlined"
        >
          <WalletOutlined style={{ fontSize: 56, color: '#bfbfbf', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#8c8c8c' }}>
            No tienes una caja abierta
          </Title>
          <Text type="secondary">
            Abre una caja para comenzar a registrar ventas y movimientos.
          </Text>

          <Divider />

          <Form form={openForm} layout="vertical">
            <Form.Item
              name="openingAmount"
              label="Monto inicial ($)"
              rules={[
                { required: true, message: 'Ingresa el monto inicial' },
                { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={1000}
                placeholder="Ej: 50000"
                prefix="$"
              />
            </Form.Item>
            <Form.Item name="notes" label="Notas (opcional)">
              <TextArea rows={2} placeholder="Observaciones iniciales" />
            </Form.Item>
            <Button
              type="primary"
              icon={<WalletOutlined />}
              block
              size="large"
              loading={openingSubmit}
              onClick={handleOpenCash}
            >
              Abrir Caja
            </Button>
          </Form>
        </Card>
      </div>
    )
  }

  // ── Hay caja abierta ────────────────────────────────────────────────────────
  const categoryOptions =
    movementType === 'INGRESO'
      ? INCOME_CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))
      : EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Caja N° {register.registerNumber}
          </Title>
          <Text type="secondary">
            Apertura: {dayjs(register.openedAt).format('DD/MM/YYYY HH:mm')} &mdash; Monto
            inicial: ${register.openingAmount.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
          </Text>
        </Col>
        <Col>
          <Button
            danger
            icon={<PoweroffOutlined />}
            onClick={() => setCloseModalOpen(true)}
          >
            Cerrar Caja
          </Button>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'movements',
            label: 'Movimientos',
            children: (
              <Row gutter={[16, 16]}>
                {/* Form nuevo movimiento */}
                <Col xs={24} md={8}>
                  <Card title="Agregar Movimiento">
                    <Form form={movForm} layout="vertical">
                      <Form.Item
                        name="movementType"
                        label="Tipo"
                        initialValue="INGRESO"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            {
                              value: 'INGRESO',
                              label: (
                                <Space>
                                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                                  Ingreso
                                </Space>
                              ),
                            },
                            {
                              value: 'EGRESO',
                              label: (
                                <Space>
                                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                                  Egreso
                                </Space>
                              ),
                            },
                          ]}
                          onChange={(v) => {
                            setMovementType(v as 'INGRESO' | 'EGRESO')
                            movForm.setFieldValue('category', undefined)
                          }}
                        />
                      </Form.Item>
                      <Form.Item
                        name="category"
                        label="Categoría"
                        rules={[{ required: true, message: 'Selecciona una categoría' }]}
                      >
                        <Select options={categoryOptions} placeholder="Seleccionar" />
                      </Form.Item>
                      <Form.Item
                        name="amount"
                        label="Monto ($)"
                        rules={[
                          { required: true, message: 'Ingresa el monto' },
                          { type: 'number', min: 1, message: 'Debe ser mayor a 0' },
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          min={1}
                          prefix="$"
                          placeholder="Ej: 5000"
                        />
                      </Form.Item>
                      <Form.Item
                        name="description"
                        label="Descripción"
                        rules={[{ required: true, message: 'Ingresa una descripción' }]}
                      >
                        <Input placeholder="Detalle del movimiento" />
                      </Form.Item>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        block
                        loading={movSubmit}
                        onClick={handleAddMovement}
                      >
                        Registrar
                      </Button>
                    </Form>
                  </Card>
                </Col>

                {/* Tabla movimientos */}
                <Col xs={24} md={16}>
                  <Card title="Movimientos Recientes">
                    <Table
                      rowKey="id"
                      dataSource={movements}
                      columns={movementColumns}
                      loading={movementsLoading}
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      size="small"
                      scroll={{ x: 500 }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'summary',
            label: 'Resumen',
            children: summary ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Total Ventas"
                      value={summary.totalSales}
                      prefix="$"
                      precision={0}
                      valueStyle={{ color: '#1677ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Total Ingresos"
                      value={summary.totalIncome}
                      prefix="$"
                      precision={0}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Total Egresos"
                      value={summary.totalExpense}
                      prefix="$"
                      precision={0}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card>
                    <Statistic
                      title="Monto Esperado"
                      value={summary.expectedAmount}
                      prefix="$"
                      precision={0}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
              </Row>
            ) : (
              <Spin />
            ),
          },
        ]}
      />

      {/* Modal Cerrar Caja */}
      <Modal
        title="Cerrar Caja"
        open={closeModalOpen}
        onCancel={() => {
          setCloseModalOpen(false)
          closeForm.resetFields()
          setCountedAmount(null)
        }}
        onOk={handleCloseCash}
        okText="Confirmar Cierre"
        okButtonProps={{ danger: true, loading: closeSubmit }}
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={closeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary">Monto Esperado</Text>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
                ${expectedAmount.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
              </div>
            </Col>
          </Row>

          <Form.Item
            name="countedAmount"
            label="Monto Contado Físicamente ($)"
            rules={[
              { required: true, message: 'Ingresa el monto contado' },
              { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              prefix="$"
              placeholder="Ingresa el monto que contaste"
              onChange={(val) => setCountedAmount(val)}
            />
          </Form.Item>

          {difference != null && (
            <Alert
              type={difference === 0 ? 'success' : difference > 0 ? 'warning' : 'error'}
              showIcon
              message={
                <Text>
                  Diferencia:{' '}
                  <Text strong style={{ color: difference >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {difference >= 0 ? '+' : ''}$
                    {difference.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
                  </Text>
                  {difference > 0 && ' (sobrante)'}
                  {difference < 0 && ' (faltante)'}
                  {difference === 0 && ' (cuadra exacto)'}
                </Text>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          <Form.Item name="notes" label="Notas (opcional)">
            <TextArea rows={2} placeholder="Observaciones del cierre" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CashPage
