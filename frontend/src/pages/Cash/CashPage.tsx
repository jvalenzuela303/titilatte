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
  Descriptions,
  App,
} from 'antd'
import {
  WalletOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  HistoryOutlined,
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

  // Historial
  const [history, setHistory] = useState<CashRegister[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [detailRegister, setDetailRegister] = useState<CashRegister | null>(null)
  const [detailSummary, setDetailSummary] = useState<CashSummary | null>(null)
  const [detailMovements, setDetailMovements] = useState<CashMovement[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

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

  const fetchHistory = useCallback(async (page = 0) => {
    setHistoryLoading(true)
    try {
      const res = await cashService.getHistory(page, 15)
      setHistory(res.data.content)
      setHistoryTotal(res.data.totalElements)
      setHistoryPage(page)
    } catch {
      message.error('Error al cargar el historial de caja')
    } finally {
      setHistoryLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (reg: CashRegister) => {
    setDetailRegister(reg)
    setDetailSummary(null)
    setDetailMovements([])
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const [sumRes, movRes] = await Promise.all([
        cashService.getSummary(reg.id),
        cashService.getMovements(reg.id),
      ])
      setDetailSummary(sumRes.data)
      setDetailMovements(movRes.data.content ?? [])
    } catch {
      message.error('Error al cargar el detalle de caja')
    } finally {
      setDetailLoading(false)
    }
  }

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
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        message.error('Ya hay una caja abierta en esta sucursal. Ciérrala antes de abrir una nueva.')
        await fetchCurrent()
      } else {
        message.error('Error al abrir la caja')
      }
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
      <>
        <Tabs
          defaultActiveKey="open"
          onChange={(key) => {
            if (key === 'history' && history.length === 0) fetchHistory(0)
          }}
          items={[
            {
              key: 'open',
              label: (
                <Space><WalletOutlined />Abrir Caja</Space>
              ),
              children: (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32 }}>
                  <Card style={{ width: '100%', maxWidth: 460, textAlign: 'center' }} variant="outlined">
                    <WalletOutlined style={{ fontSize: 56, color: '#bfbfbf', marginBottom: 16 }} />
                    <Title level={4} style={{ color: '#8c8c8c' }}>No tienes una caja abierta</Title>
                    <Text type="secondary">Abre una caja para comenzar a registrar ventas y movimientos.</Text>
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
                        <InputNumber style={{ width: '100%' }} min={0} step={1000} placeholder="Ej: 50000" prefix="$" />
                      </Form.Item>
                      <Form.Item name="notes" label="Notas (opcional)">
                        <TextArea rows={2} placeholder="Observaciones iniciales" />
                      </Form.Item>
                      <Button type="primary" icon={<WalletOutlined />} block size="large" loading={openingSubmit} onClick={handleOpenCash}>
                        Abrir Caja
                      </Button>
                    </Form>
                  </Card>
                </div>
              ),
            },
            {
              key: 'history',
              label: (
                <Space><HistoryOutlined />Historial</Space>
              ),
              children: (
                <HistoryTab
                  history={history}
                  loading={historyLoading}
                  total={historyTotal}
                  page={historyPage}
                  onPageChange={fetchHistory}
                  onDetail={openDetail}
                />
              ),
            },
          ]}
        />

        {/* Modal Detalle de Caja (historial sin caja abierta) */}
        <Modal
          title={detailRegister ? `Caja N° ${detailRegister.registerNumber} — ${dayjs(detailRegister.openedAt).format('DD/MM/YYYY')}` : 'Detalle de Caja'}
          open={detailOpen}
          onCancel={() => { setDetailOpen(false); setDetailRegister(null) }}
          footer={null}
          width={760}
        >
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : detailSummary && (
            <>
              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                {[
                  { label: 'Apertura', value: detailSummary.openingAmount, color: '#595959' },
                  { label: 'Ventas', value: detailSummary.totalSales, color: '#1677ff' },
                  { label: 'Ingresos', value: detailSummary.totalIncome, color: '#52c41a' },
                  { label: 'Egresos', value: detailSummary.totalExpense, color: '#ff4d4f' },
                  { label: 'Esperado', value: detailSummary.expectedAmount, color: '#722ed1' },
                  { label: 'Contado', value: detailSummary.countedAmount ?? 0, color: '#13c2c2' },
                ].map(({ label, value, color }) => (
                  <Col xs={12} sm={8} key={label}>
                    <Card size="small">
                      <Statistic title={label} value={value} prefix="$" precision={0} valueStyle={{ color, fontSize: 16 }} />
                    </Card>
                  </Col>
                ))}
              </Row>
              {detailSummary.countedAmount != null && (
                <Alert
                  style={{ marginBottom: 12 }}
                  showIcon
                  type={(detailSummary.difference ?? 0) === 0 ? 'success' : (detailSummary.difference ?? 0) > 0 ? 'warning' : 'error'}
                  message={
                    <Text>
                      Diferencia:{' '}
                      <Text strong style={{ color: (detailSummary.difference ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {(detailSummary.difference ?? 0) >= 0 ? '+' : ''}${Math.round(detailSummary.difference ?? 0).toLocaleString('es-CL')}
                      </Text>
                      {(detailSummary.difference ?? 0) > 0 && ' (sobrante)'}
                      {(detailSummary.difference ?? 0) < 0 && ' (faltante)'}
                      {(detailSummary.difference ?? 0) === 0 && ' (cuadra exacto)'}
                    </Text>
                  }
                />
              )}
              <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Apertura">{dayjs(detailSummary.openedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
                <Descriptions.Item label="Cierre">{detailSummary.closedAt ? dayjs(detailSummary.closedAt).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
                <Descriptions.Item label="Cajero" span={2}>{detailSummary.cashierName}</Descriptions.Item>
              </Descriptions>
              <Table
                rowKey="id"
                dataSource={detailMovements}
                size="small"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: 'Tipo', dataIndex: 'movementType', width: 120, render: (v: CashMovement['movementType']) => <Tag color={movementTypeColor[v]}>{movementTypeLabel[v]}</Tag> },
                  { title: 'Descripción', dataIndex: 'description', ellipsis: true },
                  { title: 'Monto', dataIndex: 'amount', align: 'right' as const, width: 110, render: (v: number, r: CashMovement) => <Text strong style={{ color: r.movementType === 'EGRESO' ? '#ff4d4f' : '#52c41a' }}>{r.movementType === 'EGRESO' ? '-' : '+'}${Math.round(v).toLocaleString('es-CL')}</Text> },
                  { title: 'Hora', dataIndex: 'createdAt', width: 70, render: (v: string) => dayjs(v).format('HH:mm') },
                ]}
              />
            </>
          )}
        </Modal>
      </>
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
          {
            key: 'history',
            label: (
              <Space>
                <HistoryOutlined />
                Historial
              </Space>
            ),
            children: <HistoryTab
              history={history}
              loading={historyLoading}
              total={historyTotal}
              page={historyPage}
              onPageChange={fetchHistory}
              onDetail={openDetail}
            />,
          },
        ]}
        onChange={(key) => {
          setActiveTab(key)
          if (key === 'history' && history.length === 0) fetchHistory(0)
        }}
      />

      {/* Modal Detalle de Caja (historial) */}
      <Modal
        title={
          detailRegister
            ? `Caja N° ${detailRegister.registerNumber} — ${dayjs(detailRegister.openedAt).format('DD/MM/YYYY')}`
            : 'Detalle de Caja'
        }
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailRegister(null) }}
        footer={null}
        width={760}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : detailSummary && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {[
                { label: 'Apertura', value: detailSummary.openingAmount, color: '#595959' },
                { label: 'Ventas', value: detailSummary.totalSales, color: '#1677ff' },
                { label: 'Ingresos', value: detailSummary.totalIncome, color: '#52c41a' },
                { label: 'Egresos', value: detailSummary.totalExpense, color: '#ff4d4f' },
                { label: 'Esperado', value: detailSummary.expectedAmount, color: '#722ed1' },
                { label: 'Contado', value: detailSummary.countedAmount ?? 0, color: '#13c2c2' },
              ].map(({ label, value, color }) => (
                <Col xs={12} sm={8} key={label}>
                  <Card size="small">
                    <Statistic title={label} value={value} prefix="$" precision={0} valueStyle={{ color, fontSize: 16 }} />
                  </Card>
                </Col>
              ))}
            </Row>
            {detailSummary.countedAmount != null && (
              <Alert
                style={{ marginBottom: 12 }}
                showIcon
                type={
                  (detailSummary.difference ?? 0) === 0
                    ? 'success'
                    : (detailSummary.difference ?? 0) > 0
                      ? 'warning'
                      : 'error'
                }
                message={
                  <Text>
                    Diferencia:{' '}
                    <Text strong style={{ color: (detailSummary.difference ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {(detailSummary.difference ?? 0) >= 0 ? '+' : ''}$
                      {Math.round(detailSummary.difference ?? 0).toLocaleString('es-CL')}
                    </Text>
                    {(detailSummary.difference ?? 0) > 0 && ' (sobrante)'}
                    {(detailSummary.difference ?? 0) < 0 && ' (faltante)'}
                    {(detailSummary.difference ?? 0) === 0 && ' (cuadra exacto)'}
                  </Text>
                }
              />
            )}
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Apertura">{dayjs(detailSummary.openedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="Cierre">{detailSummary.closedAt ? dayjs(detailSummary.closedAt).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Cajero" span={2}>{detailSummary.cashierName}</Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="id"
              dataSource={detailMovements}
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              columns={[
                {
                  title: 'Tipo',
                  dataIndex: 'movementType',
                  width: 120,
                  render: (v: CashMovement['movementType']) => (
                    <Tag color={movementTypeColor[v]}>{movementTypeLabel[v]}</Tag>
                  ),
                },
                { title: 'Descripción', dataIndex: 'description', ellipsis: true },
                {
                  title: 'Monto',
                  dataIndex: 'amount',
                  align: 'right' as const,
                  width: 110,
                  render: (v: number, r: CashMovement) => (
                    <Text strong style={{ color: r.movementType === 'EGRESO' ? '#ff4d4f' : '#52c41a' }}>
                      {r.movementType === 'EGRESO' ? '-' : '+'}${Math.round(v).toLocaleString('es-CL')}
                    </Text>
                  ),
                },
                {
                  title: 'Hora',
                  dataIndex: 'createdAt',
                  width: 70,
                  render: (v: string) => dayjs(v).format('HH:mm'),
                },
              ]}
            />
          </>
        )}
      </Modal>

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
        forceRender
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

// ── Historial de Caja (sub-componente) ─────────────────────────────────────

interface HistoryTabProps {
  history: CashRegister[]
  loading: boolean
  total: number
  page: number
  onPageChange: (page: number) => void
  onDetail: (reg: CashRegister) => void
}

const HistoryTab: React.FC<HistoryTabProps> = ({
  history, loading, total, page, onPageChange, onDetail,
}) => {
  const columns: ColumnsType<CashRegister> = [
    {
      title: 'N° Caja',
      dataIndex: 'registerNumber',
      width: 80,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Cajero',
      dataIndex: 'cashierName',
      ellipsis: true,
    },
    {
      title: 'Apertura',
      dataIndex: 'openedAt',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Cierre',
      dataIndex: 'closedAt',
      width: 140,
      render: (v?: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: 'Apertura ($)',
      dataIndex: 'openingAmount',
      align: 'right',
      width: 110,
      render: (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`,
    },
    {
      title: 'Esperado ($)',
      dataIndex: 'expectedClosingAmount',
      align: 'right',
      width: 110,
      render: (v?: number) => v != null ? `$${Math.round(v).toLocaleString('es-CL')}` : '—',
    },
    {
      title: 'Contado ($)',
      dataIndex: 'countedAmount',
      align: 'right',
      width: 110,
      render: (v?: number) => v != null ? `$${Math.round(v).toLocaleString('es-CL')}` : '—',
    },
    {
      title: 'Diferencia',
      dataIndex: 'differenceAmount',
      align: 'right',
      width: 100,
      render: (v?: number) => {
        if (v == null) return '—'
        const color = v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#595959'
        return <Text strong style={{ color }}>{v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('es-CL')}</Text>
      },
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => <Tag color={v === 'OPEN' ? 'success' : 'default'}>{v === 'OPEN' ? 'Abierta' : 'Cerrada'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: CashRegister) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(record)} />
      ),
    },
  ]

  return (
    <Card>
      <Table
        rowKey="id"
        dataSource={history}
        columns={columns}
        loading={loading}
        scroll={{ x: 900 }}
        size="small"
        pagination={{
          current: page + 1,
          pageSize: 15,
          total,
          showSizeChanger: false,
          onChange: (p) => onPageChange(p - 1),
        }}
      />
    </Card>
  )
}

export default CashPage
