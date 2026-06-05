import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  Card,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  theme,
  Switch,
  DatePicker,
  Popconfirm,
  Alert,
  App,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  PercentageOutlined,
  TagOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import promotionService from '@/services/promotionService'
import productService from '@/services/productService'
import { useAuth } from '@/hooks/useAuth'
import type {
  Promotion,
  PromotionType,
  PromotionAppliesTo,
  CreatePromotionRequest,
  Product,
  ProductCategory2,
} from '@/types'

const { Text } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input

// ─── Promotion type config ────────────────────────────────────────────────────

const promotionTypeConfig: Record<PromotionType, { color: string; label: string }> = {
  PERCENTAGE: { color: 'green', label: '% Descuento' },
  FIXED_PRICE: { color: 'blue', label: 'Precio Fijo' },
  TWO_FOR_ONE: { color: 'purple', label: '2x1 / Bundle' },
  QUANTITY_DISCOUNT: { color: 'orange', label: 'Dto. por Volumen' },
}

const appliesToLabels: Record<PromotionAppliesTo, string> = {
  SPECIFIC_PRODUCTS: 'Productos específicos',
  ALL_PRODUCTS: 'Todos los productos',
  CATEGORY: 'Categoría',
}

// ─── Plain-language preview of what a promotion does ─────────────────────────

function buildPromotionPreview(values: Partial<FormValues>): string {
  const { type, value, minQuantity, bonusQuantity, appliesTo } = values
  const scope =
    appliesTo === 'ALL_PRODUCTS'
      ? 'todos los productos'
      : appliesTo === 'CATEGORY'
      ? 'los productos de la categoría seleccionada'
      : 'los productos seleccionados'

  switch (type) {
    case 'PERCENTAGE':
      if (value != null) {
        return `El cliente obtiene un ${(value * 100).toFixed(0)}% de descuento en ${scope}.`
      }
      return `Descuento porcentual en ${scope}.`
    case 'FIXED_PRICE':
      if (value != null) {
        return `El cliente paga un precio fijo de $${value.toFixed(2)} por unidad en ${scope}.`
      }
      return `Precio fijo especial en ${scope}.`
    case 'TWO_FOR_ONE': {
      const min = minQuantity ?? 2
      const bonus = bonusQuantity ?? 1
      return `Comprando ${min} unidades de ${scope}, el cliente se lleva ${bonus} unidad${bonus > 1 ? 'es' : ''} gratis.`
    }
    case 'QUANTITY_DISCOUNT':
      if (value != null && minQuantity != null) {
        return `Al comprar ${minQuantity} o más unidades de ${scope}, el cliente obtiene un ${(value * 100).toFixed(0)}% de descuento.`
      }
      return `Descuento por volumen en ${scope}.`
    default:
      return 'Configura los campos para ver la descripción de la promoción.'
  }
}

// ─── Form shape ───────────────────────────────────────────────────────────────

interface FormValues {
  name: string
  description?: string
  type: PromotionType
  value?: number
  minQuantity: number
  bonusQuantity?: number
  appliesTo: PromotionAppliesTo
  categoryId?: string
  productIds?: string[]
  dateRange: [dayjs.Dayjs, dayjs.Dayjs]
  active: boolean
}

// ─── PromotionForm modal ──────────────────────────────────────────────────────

interface PromotionFormProps {
  open: boolean
  editing: Promotion | null
  onClose: () => void
  onSubmit: (data: CreatePromotionRequest) => Promise<void>
  isSubmitting: boolean
  isAdmin: boolean
}

const PromotionForm: React.FC<PromotionFormProps> = ({
  open,
  editing,
  onClose,
  onSubmit,
  isSubmitting,
  isAdmin,
}) => {
  const [form] = Form.useForm<FormValues>()
  const [promotionType, setPromotionType] = useState<PromotionType | undefined>(undefined)
  const [appliesTo, setAppliesTo] = useState<PromotionAppliesTo | undefined>(undefined)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory2[]>([])
  const [previewText, setPreviewText] = useState<string>('')

  const loadProducts = useCallback(async () => {
    try {
      const res = await productService.getProducts({ size: 200, active: true })
      setProducts(res.data.content)
      // Extract unique categories from products
      const catMap = new Map<string, ProductCategory2>()
      res.data.content.forEach((p) => {
        if (p.category && !catMap.has(p.category.id)) {
          catMap.set(p.category.id, p.category)
        }
      })
      setCategories(Array.from(catMap.values()))
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadProducts()
      if (editing) {
        const type = editing.type
        const aTo = editing.appliesTo
        setPromotionType(type)
        setAppliesTo(aTo)
        form.setFieldsValue({
          name: editing.name,
          description: editing.description ?? undefined,
          type,
          value: editing.value ?? undefined,
          minQuantity: editing.minQuantity,
          bonusQuantity: editing.bonusQuantity ?? undefined,
          appliesTo: aTo,
          categoryId: editing.categoryId ?? undefined,
          productIds: editing.productIds,
          dateRange: [dayjs(editing.startsAt), dayjs(editing.endsAt)],
          active: editing.active,
        })
        setPreviewText(buildPromotionPreview({
          type,
          value: editing.value ?? undefined,
          minQuantity: editing.minQuantity,
          bonusQuantity: editing.bonusQuantity ?? undefined,
          appliesTo: aTo,
        }))
      } else {
        form.resetFields()
        form.setFieldsValue({ active: true, minQuantity: 1 })
        setPromotionType(undefined)
        setAppliesTo(undefined)
        setPreviewText('')
      }
    }
  }, [open, editing, form, loadProducts])

  const handleValuesChange = () => {
    const values = form.getFieldsValue()
    setPreviewText(buildPromotionPreview(values as Partial<FormValues>))
  }

  const handleFinish = async (values: FormValues) => {
    const payload: CreatePromotionRequest = {
      name: values.name,
      description: values.description,
      type: values.type,
      value: values.value,
      minQuantity: values.minQuantity ?? 1,
      bonusQuantity: values.bonusQuantity,
      appliesTo: values.appliesTo,
      categoryId: values.categoryId,
      startsAt: values.dateRange[0].toISOString(),
      endsAt: values.dateRange[1].toISOString(),
      active: values.active,
      productIds: values.productIds,
    }
    await onSubmit(payload)
  }

  const showValueField =
    promotionType === 'PERCENTAGE' ||
    promotionType === 'FIXED_PRICE' ||
    promotionType === 'QUANTITY_DISCOUNT'

  const showMinQty =
    promotionType === 'TWO_FOR_ONE' || promotionType === 'QUANTITY_DISCOUNT'

  const showBonusQty = promotionType === 'TWO_FOR_ONE'

  return (
    <Modal
      title={editing ? 'Editar Promoción' : 'Nueva Promoción'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Guardar cambios' : 'Crear promoción'}
      cancelText="Cancelar"
      confirmLoading={isSubmitting}
      forceRender
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        onValuesChange={handleValuesChange}
        style={{ marginTop: 8 }}
      >
        <Form.Item
          label="Nombre"
          name="name"
          rules={[{ required: true, message: 'El nombre es obligatorio' }]}
        >
          <Input placeholder="Ej: Descuento 20% en bebidas" />
        </Form.Item>

        <Form.Item label="Descripción" name="description">
          <TextArea rows={2} placeholder="Descripción interna de la promoción (opcional)" />
        </Form.Item>

        <Form.Item
          label="Tipo de promoción"
          name="type"
          rules={[{ required: true, message: 'Selecciona el tipo' }]}
        >
          <Select
            placeholder="Seleccionar tipo..."
            onChange={(val: PromotionType) => {
              setPromotionType(val)
              form.setFieldsValue({ value: undefined, minQuantity: 1, bonusQuantity: undefined })
            }}
            options={Object.entries(promotionTypeConfig).map(([value, cfg]) => ({
              value,
              label: (
                <Tag color={cfg.color} style={{ margin: 0 }}>
                  {cfg.label}
                </Tag>
              ),
            }))}
          />
        </Form.Item>

        {showValueField && (
          <Form.Item
            label={
              promotionType === 'FIXED_PRICE'
                ? 'Precio fijo por unidad ($)'
                : 'Porcentaje de descuento (%)'
            }
            name="value"
            rules={[{ required: true, message: 'Este campo es obligatorio' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={promotionType !== 'FIXED_PRICE' ? 100 : undefined}
              precision={2}
              prefix={promotionType === 'FIXED_PRICE' ? '$' : undefined}
              suffix={promotionType !== 'FIXED_PRICE' ? '%' : undefined}
              placeholder="0"
            />
          </Form.Item>
        )}

        {showMinQty && (
          <Form.Item
            label="Cantidad mínima requerida"
            name="minQuantity"
            rules={[{ required: true, message: 'La cantidad mínima es obligatoria' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="2" />
          </Form.Item>
        )}

        {showBonusQty && (
          <Form.Item
            label="Unidades gratis (bonusQuantity)"
            name="bonusQuantity"
            rules={[{ required: true, message: 'Indica cuántas unidades gratis' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="1" />
          </Form.Item>
        )}

        <Form.Item
          label="Aplica a"
          name="appliesTo"
          rules={[{ required: true, message: 'Selecciona a quién aplica' }]}
        >
          <Select
            placeholder="Seleccionar..."
            onChange={(val: PromotionAppliesTo) => {
              setAppliesTo(val)
              form.setFieldsValue({ categoryId: undefined, productIds: [] })
            }}
            options={[
              { value: 'ALL_PRODUCTS', label: 'Todos los productos' },
              { value: 'CATEGORY', label: 'Por categoría' },
              { value: 'SPECIFIC_PRODUCTS', label: 'Productos específicos' },
            ]}
          />
        </Form.Item>

        {appliesTo === 'CATEGORY' && (
          <Form.Item
            label="Categoría"
            name="categoryId"
            rules={[{ required: true, message: 'Selecciona una categoría' }]}
          >
            <Select
              showSearch
              placeholder="Buscar categoría..."
              optionFilterProp="label"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        )}

        {appliesTo === 'SPECIFIC_PRODUCTS' && (
          <Form.Item
            label="Productos"
            name="productIds"
            rules={[{ required: true, message: 'Selecciona al menos un producto' }]}
          >
            <Select
              mode="multiple"
              showSearch
              placeholder="Buscar productos..."
              optionFilterProp="label"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.barcode})`,
              }))}
            />
          </Form.Item>
        )}

        <Form.Item
          label="Vigencia (inicio – fin)"
          name="dateRange"
          rules={[{ required: true, message: 'Selecciona el rango de vigencia' }]}
        >
          <RangePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            style={{ width: '100%' }}
          />
        </Form.Item>

        {isAdmin && (
          <Form.Item label="Sucursal (opcional)" name="branchId">
            <Input placeholder="ID de sucursal (dejar en blanco para todas)" />
          </Form.Item>
        )}

        <Form.Item label="Activa" name="active" valuePropName="checked">
          <Switch checkedChildren="Activa" unCheckedChildren="Inactiva" />
        </Form.Item>

        {previewText && (
          <Alert
            type="info"
            showIcon
            icon={<PercentageOutlined />}
            message="Vista previa de la promoción"
            description={previewText}
            style={{ marginTop: 4 }}
          />
        )}
      </Form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PromotionsPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { isAdmin, isSupervisor } = useAuth()
  const canManage = isAdmin || isSupervisor

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadPromotions = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const res = await promotionService.getAll({ page: p - 1, size: 20 })
      setPromotions(res.data.content)
      setTotal(res.data.totalElements)
      setPage(p)
    } catch {
      message.error('Error al cargar las promociones')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPromotions(1)
  }, [loadPromotions])

  const handleSubmit = async (data: CreatePromotionRequest) => {
    setIsSubmitting(true)
    try {
      if (editing) {
        await promotionService.update(editing.id, data)
        message.success('Promoción actualizada exitosamente')
      } else {
        await promotionService.create(data)
        message.success('Promoción creada exitosamente')
      }
      setFormOpen(false)
      setEditing(null)
      loadPromotions(page)
    } catch {
      message.error('Error al guardar la promoción')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async (promo: Promotion) => {
    try {
      await promotionService.deactivate(promo.id)
      message.success(`"${promo.name}" desactivada`)
      loadPromotions(page)
    } catch {
      message.error('Error al desactivar la promoción')
    }
  }

  // KPIs
  const now = dayjs()
  const activeCount = promotions.filter(
    (p) => p.active && dayjs(p.startsAt).isBefore(now) && dayjs(p.endsAt).isAfter(now)
  ).length
  const scheduledCount = promotions.filter(
    (p) => p.active && dayjs(p.startsAt).isAfter(now)
  ).length
  const expiredCount = promotions.filter(
    (p) => dayjs(p.endsAt).isBefore(now)
  ).length

  const columns: ColumnsType<Promotion> = [
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
      width: 150,
      render: (v: PromotionType) => {
        const cfg = promotionTypeConfig[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Valor',
      key: 'value',
      width: 120,
      render: (_: unknown, record: Promotion) => {
        if (record.type === 'PERCENTAGE' || record.type === 'QUANTITY_DISCOUNT') {
          return record.value != null ? (
            <Text>
              <PercentageOutlined /> {(record.value * 100).toFixed(0)}%
            </Text>
          ) : (
            '—'
          )
        }
        if (record.type === 'FIXED_PRICE') {
          return record.value != null ? (
            <Text strong style={{ color: token.colorPrimary }}>
              ${record.value.toFixed(2)}
            </Text>
          ) : (
            '—'
          )
        }
        // TWO_FOR_ONE
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.minQuantity}+{record.bonusQuantity ?? 1} gratis
          </Text>
        )
      },
    },
    {
      title: 'Vigencia',
      key: 'vigencia',
      width: 200,
      render: (_: unknown, record: Promotion) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            {dayjs(record.startsAt).format('DD/MM/YYYY HH:mm')}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            hasta {dayjs(record.endsAt).format('DD/MM/YYYY HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Aplica a',
      dataIndex: 'appliesTo',
      key: 'appliesTo',
      width: 160,
      render: (v: PromotionAppliesTo, record: Promotion) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{appliesToLabels[v]}</Text>
          {record.categoryName && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.categoryName}
            </Text>
          )}
          {v === 'SPECIFIC_PRODUCTS' && record.productIds.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.productIds.length} producto{record.productIds.length !== 1 ? 's' : ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 100,
      align: 'center',
      render: (_: unknown, record: Promotion) => {
        const isExpired = dayjs(record.endsAt).isBefore(now)
        const isScheduled = record.active && dayjs(record.startsAt).isAfter(now)
        if (isExpired) return <Tag color="default">Vencida</Tag>
        if (!record.active) return <Tag color="red">Inactiva</Tag>
        if (isScheduled) return <Tag color="blue">Programada</Tag>
        return <Tag color="green">Activa</Tag>
      },
    },
    ...(canManage
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            width: 100,
            fixed: 'right' as const,
            render: (_: unknown, record: Promotion) => (
              <Space size="small">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(record)
                    setFormOpen(true)
                  }}
                />
                {record.active && (
                  <Popconfirm
                    title="Desactivar promoción"
                    description={`¿Desactivar "${record.name}"?`}
                    onConfirm={() => handleDeactivate(record)}
                    okText="Desactivar"
                    cancelText="Cancelar"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<StopOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Promociones"
        subtitle="Gestiona descuentos y ofertas activas"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Promociones' }]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadPromotions(1)}>
              Actualizar
            </Button>
            {canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Nueva Promoción
              </Button>
            )}
          </Space>
        }
      />

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card
            variant="borderless"
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              borderLeft: `4px solid ${token.colorSuccess}`,
            }}
          >
            <Statistic
              title="Activas ahora"
              value={activeCount}
              valueStyle={{ color: token.colorSuccess }}
              prefix={<TagOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            variant="borderless"
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              borderLeft: `4px solid ${token.colorInfo}`,
            }}
          >
            <Statistic
              title="Programadas"
              value={scheduledCount}
              valueStyle={{ color: token.colorInfo }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            variant="borderless"
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              borderLeft: `4px solid ${token.colorTextDisabled}`,
            }}
          >
            <Statistic
              title="Vencidas"
              value={expiredCount}
              valueStyle={{ color: token.colorTextDisabled }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Table
          columns={columns}
          dataSource={promotions}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => loadPromotions(p),
            showTotal: (t) => `${t} promociones`,
          }}
        />
      </Card>

      <PromotionForm
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isAdmin={isAdmin}
      />
    </div>
  )
}

export default PromotionsPage
