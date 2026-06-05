import React, { useState, useEffect, useCallback } from 'react'
import {
  Tabs,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  Switch,
  Space,
  Typography,
  Tooltip,
  Card,
  Alert,
  theme,
  Spin,
  App,
  Popconfirm,
} from 'antd'
import {
  BellOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  EditOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import alertService from '@/services/alertService'
import { useAuth } from '@/hooks/useAuth'
import type { AlertRule, AlertHistory, CreateAlertRuleRequest, AlertType, AlertSeverity } from '@/types'

const { Text } = Typography

const alertTypeConfig: Record<
  AlertType,
  { label: string; color: string; icon: React.ReactNode; description: string; usesMinutes: boolean }
> = {
  SALES_BELOW_THRESHOLD: {
    label: 'Ventas bajas',
    color: 'red',
    icon: <DollarOutlined />,
    description: 'Dispara si las ventas del día son menores al umbral definido',
    usesMinutes: false,
  },
  CASH_OPEN_TOO_LONG: {
    label: 'Caja abierta',
    color: 'orange',
    icon: <ClockCircleOutlined />,
    description: 'Dispara si alguna caja lleva abierta más del tiempo definido',
    usesMinutes: true,
  },
  LOW_STOCK_COUNT: {
    label: 'Stock bajo',
    color: 'gold',
    icon: <InboxOutlined />,
    description: 'Dispara si hay más productos con stock bajo que el umbral definido',
    usesMinutes: false,
  },
  HIGH_DEBT_TOTAL: {
    label: 'Deuda alta',
    color: 'purple',
    icon: <DollarOutlined />,
    description: 'Dispara si la deuda total de clientes supera el umbral',
    usesMinutes: false,
  },
}

const severityConfig: Record<AlertSeverity, { color: string; label: string }> = {
  INFO: { color: 'blue', label: 'Informativo' },
  WARNING: { color: 'orange', label: 'Advertencia' },
  CRITICAL: { color: 'red', label: 'Crítico' },
}

interface AlertRuleFormValues {
  name: string
  description?: string
  type: AlertType
  thresholdValue?: number
  checkIntervalMinutes: number
  recipientRole: string
  active: boolean
}

const AlertsPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { isAdmin } = useAuth()

  const [rules, setRules] = useState<AlertRule[]>([])
  const [history, setHistory] = useState<AlertHistory[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [activeTab, setActiveTab] = useState('rules')
  const [selectedType, setSelectedType] = useState<AlertType | null>(null)

  const [form] = Form.useForm<AlertRuleFormValues>()

  const loadRules = useCallback(async () => {
    setIsLoadingRules(true)
    try {
      const res = await alertService.getRules()
      setRules(res.data.content)
    } catch {
      message.error('Error al cargar las reglas de alerta')
    } finally {
      setIsLoadingRules(false)
    }
  }, [])

  const loadHistory = useCallback(async (page = 1) => {
    setIsLoadingHistory(true)
    try {
      const res = await alertService.getHistory(page - 1, 20)
      setHistory(res.data.content)
      setHistoryTotal(res.data.totalElements)
      setHistoryPage(page)
    } catch {
      message.error('Error al cargar el historial de alertas')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory(1)
    }
  }, [activeTab, loadHistory])

  const handleOpenCreateModal = () => {
    setEditingRule(null)
    setSelectedType(null)
    form.resetFields()
    form.setFieldsValue({ active: true, checkIntervalMinutes: 60 })
    setRuleModalOpen(true)
  }

  const handleOpenEditModal = (rule: AlertRule) => {
    setEditingRule(rule)
    setSelectedType(rule.type)
    form.setFieldsValue({
      name: rule.name,
      description: rule.description ?? undefined,
      type: rule.type,
      thresholdValue: rule.thresholdValue ?? rule.thresholdMinutes ?? undefined,
      checkIntervalMinutes: rule.checkIntervalMinutes,
      recipientRole: rule.recipientRole,
      active: rule.active,
    })
    setRuleModalOpen(true)
  }

  const handleSubmit = async (values: AlertRuleFormValues) => {
    if (!selectedType) return
    setIsSubmitting(true)

    const cfg = alertTypeConfig[selectedType]
    const payload: CreateAlertRuleRequest = {
      name: values.name,
      description: values.description,
      type: selectedType,
      checkIntervalMinutes: values.checkIntervalMinutes,
      recipientRole: values.recipientRole,
      active: values.active,
    }

    if (cfg.usesMinutes) {
      payload.thresholdMinutes = values.thresholdValue
    } else {
      payload.thresholdValue = values.thresholdValue
    }

    try {
      if (editingRule) {
        await alertService.updateRule(editingRule.id, payload)
        message.success('Regla actualizada exitosamente')
      } else {
        await alertService.createRule(payload)
        message.success('Regla creada exitosamente')
      }
      setRuleModalOpen(false)
      form.resetFields()
      loadRules()
    } catch {
      message.error('Error al guardar la regla')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await alertService.deactivateRule(id)
      message.success('Regla desactivada')
      loadRules()
    } catch {
      message.error('Error al desactivar la regla')
    }
  }

  const handleAcknowledge = async (id: string) => {
    try {
      await alertService.acknowledge(id)
      message.success('Alerta marcada como leída')
      loadHistory(historyPage)
    } catch {
      message.error('Error al marcar la alerta')
    }
  }

  const handleEvaluate = async () => {
    setIsEvaluating(true)
    try {
      await alertService.evaluate()
      message.success('Evaluación ejecutada. Revisa el historial para ver resultados.')
      if (activeTab === 'history') {
        loadHistory(1)
      }
    } catch {
      message.error('Error al ejecutar la evaluación')
    } finally {
      setIsEvaluating(false)
    }
  }

  const rulesColumns: ColumnsType<AlertRule> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (v: AlertType) => {
        const cfg = alertTypeConfig[v]
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: 'Umbral',
      key: 'threshold',
      width: 120,
      render: (_: unknown, record: AlertRule) => {
        const cfg = alertTypeConfig[record.type]
        if (cfg.usesMinutes) {
          return <Text>{record.thresholdMinutes} min</Text>
        }
        return <Text>${record.thresholdValue?.toLocaleString() ?? '—'}</Text>
      },
    },
    {
      title: 'Evalúa cada',
      dataIndex: 'checkIntervalMinutes',
      key: 'checkIntervalMinutes',
      width: 120,
      render: (v: number) => <Text>{v} min</Text>,
    },
    {
      title: 'Último disparo',
      dataIndex: 'lastTriggeredAt',
      key: 'lastTriggeredAt',
      width: 160,
      render: (v: string | null) =>
        v ? (
          <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text>
        ) : (
          <Text type="secondary">Nunca</Text>
        ),
    },
    {
      title: 'Activo',
      dataIndex: 'active',
      key: 'active',
      width: 80,
      align: 'center',
      render: (v: boolean) => <Switch checked={v} disabled size="small" />,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 130,
      render: (_: unknown, record: AlertRule) =>
        isAdmin ? (
          <Space>
            <Tooltip title="Editar">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal(record)}
              />
            </Tooltip>
            <Popconfirm
              title="¿Desactivar esta regla?"
              description="La regla dejará de evaluarse. Puedes reactivarla editándola."
              onConfirm={() => handleDeactivate(record.id)}
              okText="Desactivar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Desactivar">
                <Button size="small" icon={<StopOutlined />} danger disabled={!record.active} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ]

  const historyColumns: ColumnsType<AlertHistory> = [
    {
      title: 'Fecha',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 160,
      render: (v: string) => (
        <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text>
      ),
    },
    {
      title: 'Regla',
      dataIndex: 'ruleName',
      key: 'ruleName',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (v: AlertType) => {
        const cfg = alertTypeConfig[v]
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: 'Severidad',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (v: AlertSeverity) => {
        const cfg = severityConfig[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Mensaje',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: 'Estado',
      key: 'status',
      width: 110,
      render: (_: unknown, record: AlertHistory) =>
        record.acknowledged ? (
          <Tag color="green">Leída</Tag>
        ) : (
          <Tag color="red">Pendiente</Tag>
        ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 130,
      render: (_: unknown, record: AlertHistory) => (
        <Button
          size="small"
          icon={<CheckOutlined />}
          disabled={record.acknowledged}
          onClick={() => handleAcknowledge(record.id)}
        >
          Marcar leída
        </Button>
      ),
    },
  ]

  const thresholdLabel: Record<AlertType, string> = {
    SALES_BELOW_THRESHOLD: 'Umbral de ventas (monto mínimo diario)',
    CASH_OPEN_TOO_LONG: 'Tiempo máximo caja abierta',
    LOW_STOCK_COUNT: 'Máximo de productos con stock bajo',
    HIGH_DEBT_TOTAL: 'Umbral de deuda total de clientes',
  }

  return (
    <div>
      <PageHeader
        title="Alertas"
        subtitle="Configura reglas de alerta y revisa el historial de disparos"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Alertas' }]}
        extra={
          isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateModal}
            >
              Nueva regla
            </Button>
          )
        }
      />

      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'rules',
              label: (
                <Space>
                  <BellOutlined />
                  Reglas configuradas
                </Space>
              ),
              children: (
                <Spin spinning={isLoadingRules}>
                  <Table
                    columns={rulesColumns}
                    dataSource={rules}
                    rowKey="id"
                    scroll={{ x: 800 }}
                    pagination={{ pageSize: 20, showTotal: (t) => `${t} reglas` }}
                  />
                </Spin>
              ),
            },
            {
              key: 'history',
              label: (
                <Space>
                  <WarningOutlined />
                  Historial de alertas
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Button
                      type="default"
                      icon={<PlayCircleOutlined />}
                      loading={isEvaluating}
                      onClick={handleEvaluate}
                    >
                      Evaluar ahora
                    </Button>
                  </div>
                  <Table
                    columns={historyColumns}
                    dataSource={history}
                    rowKey="id"
                    loading={isLoadingHistory}
                    scroll={{ x: 900 }}
                    pagination={{
                      current: historyPage,
                      pageSize: 20,
                      total: historyTotal,
                      onChange: (page) => loadHistory(page),
                      showTotal: (t) => `${t} alertas`,
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingRule ? 'Editar regla de alerta' : 'Nueva regla de alerta'}
        open={ruleModalOpen}
        onCancel={() => {
          setRuleModalOpen(false)
          setEditingRule(null)
          setSelectedType(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        okText={editingRule ? 'Guardar cambios' : 'Crear regla'}
        cancelText="Cancelar"
        confirmLoading={isSubmitting}
        forceRender
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 8 }}
          initialValues={{ active: true, checkIntervalMinutes: 60 }}
        >
          <Form.Item
            label="Nombre"
            name="name"
            rules={[{ required: true, message: 'Ingresa un nombre para la regla' }]}
          >
            <Input placeholder="Ej: Ventas bajas día hábil" />
          </Form.Item>

          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={2} placeholder="Descripción opcional de la regla..." />
          </Form.Item>

          <Form.Item
            label="Tipo de alerta"
            name="type"
            rules={[{ required: true, message: 'Selecciona el tipo de alerta' }]}
          >
            <Select
              placeholder="Seleccionar tipo..."
              onChange={(v: AlertType) => {
                setSelectedType(v)
                form.setFieldValue('thresholdValue', undefined)
              }}
              options={Object.entries(alertTypeConfig).map(([value, cfg]) => ({
                value,
                label: (
                  <Space>
                    {cfg.icon}
                    {cfg.label}
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          {selectedType && (
            <Alert
              type="info"
              message={alertTypeConfig[selectedType].description}
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          {selectedType && !alertTypeConfig[selectedType].usesMinutes && (
            <Form.Item
              label={thresholdLabel[selectedType]}
              name="thresholdValue"
              rules={[{ required: true, message: 'Ingresa el valor umbral' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                prefix={
                  selectedType === 'LOW_STOCK_COUNT' ? undefined : '$'
                }
                suffix={
                  selectedType === 'LOW_STOCK_COUNT' ? 'productos' : undefined
                }
                placeholder="Ej: 50000"
              />
            </Form.Item>
          )}

          {selectedType === 'CASH_OPEN_TOO_LONG' && (
            <Form.Item
              label={thresholdLabel['CASH_OPEN_TOO_LONG']}
              name="thresholdValue"
              rules={[{ required: true, message: 'Ingresa el tiempo máximo en minutos' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                suffix="minutos"
                placeholder="Ej: 480 (8 horas)"
              />
            </Form.Item>
          )}

          <Form.Item
            label="Evaluar cada"
            name="checkIntervalMinutes"
            rules={[{ required: true, message: 'Ingresa la frecuencia de evaluación' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              suffix="minutos"
              placeholder="Ej: 60"
            />
          </Form.Item>

          <Form.Item
            label="Notificar a rol"
            name="recipientRole"
            rules={[{ required: true, message: 'Selecciona el rol destinatario' }]}
          >
            <Select
              placeholder="Seleccionar rol..."
              options={[
                { value: 'ADMIN', label: 'Administrador' },
                { value: 'SUPERVISOR', label: 'Supervisor' },
                { value: 'BODEGA', label: 'Bodega' },
                { value: 'CAJERO', label: 'Cajero' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Activa" name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AlertsPage
