import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Card,
  Space,
  Typography,
  Tooltip,
  Badge,
  App,
  theme,
  Popconfirm,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import categoryService from '@/services/categoryService'
import type { ProductCategory, ProductFamily, CreateCategoryRequest, UpdateCategoryRequest, CreateFamilyRequest } from '@/types'

const { Text } = Typography

interface CategoryFormValues {
  code: string
  name: string
  description?: string
  familyId: string
  active: boolean
}

interface FamilyFormValues {
  code: string
  name: string
  description?: string
  active: boolean
}

const CategoriesPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()

  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [families, setFamilies] = useState<ProductFamily[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [familyModalOpen, setFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null)
  const [isFamilySubmitting, setIsFamilySubmitting] = useState(false)

  const [form] = Form.useForm<CategoryFormValues>()
  const [familyForm] = Form.useForm<FamilyFormValues>()

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await categoryService.getCategories(showInactive ? false : false)
      setCategories(res.data)
    } catch {
      message.error('Error al cargar las categorías')
    } finally {
      setIsLoading(false)
    }
  }, [showInactive])

  const loadFamilies = useCallback(async () => {
    try {
      const res = await categoryService.getAllFamilies()
      setFamilies(res.data)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])

  const handleOpenCreate = () => {
    setEditingCategory(null)
    form.resetFields()
    form.setFieldsValue({ active: true })
    setModalOpen(true)
  }

  const handleOpenEdit = (record: ProductCategory) => {
    setEditingCategory(record)
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      description: record.description ?? '',
      familyId: record.familyId,
      active: record.active,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: CategoryFormValues) => {
    setIsSubmitting(true)
    try {
      if (editingCategory) {
        const payload: UpdateCategoryRequest = {
          code: values.code,
          name: values.name,
          description: values.description || undefined,
          familyId: values.familyId,
          active: values.active,
        }
        await categoryService.update(editingCategory.id, payload)
        message.success('Categoría actualizada')
      } else {
        const payload: CreateCategoryRequest = {
          code: values.code,
          name: values.name,
          description: values.description || undefined,
          familyId: values.familyId,
          active: values.active,
        }
        await categoryService.create(payload)
        message.success('Categoría creada')
      }
      setModalOpen(false)
      form.resetFields()
      loadCategories()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 409) {
        message.error(msg ?? 'El código ya existe')
      } else {
        message.error('Error al guardar la categoría')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenCreateFamily = () => {
    setEditingFamily(null)
    familyForm.resetFields()
    familyForm.setFieldsValue({ active: true })
    setFamilyModalOpen(true)
  }

  const handleOpenEditFamily = (family: ProductFamily) => {
    setEditingFamily(family)
    familyForm.setFieldsValue({
      code: family.code,
      name: family.name,
      description: family.description ?? '',
      active: family.active,
    })
    setFamilyModalOpen(true)
  }

  const handleFamilySubmit = async (values: FamilyFormValues) => {
    setIsFamilySubmitting(true)
    try {
      const payload: CreateFamilyRequest = {
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        active: values.active,
      }
      if (editingFamily) {
        await categoryService.updateFamily(editingFamily.id, payload)
        message.success('Familia actualizada')
      } else {
        await categoryService.createFamily(payload)
        message.success('Familia creada')
      }
      setFamilyModalOpen(false)
      familyForm.resetFields()
      loadFamilies()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg ?? 'Error al guardar la familia')
    } finally {
      setIsFamilySubmitting(false)
    }
  }

  const handleDelete = (record: ProductCategory) => {
    if (record.productCount > 0) {
      modal.warning({
        title: 'No se puede eliminar',
        content: `La categoría "${record.name}" tiene ${record.productCount} producto${record.productCount !== 1 ? 's' : ''} asociado${record.productCount !== 1 ? 's' : ''}. Reasigna o elimina los productos primero.`,
      })
      return
    }
    modal.confirm({
      title: `¿Eliminar "${record.name}"?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await categoryService.delete(record.id)
          message.success('Categoría eliminada')
          loadCategories()
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          message.error(msg ?? 'Error al eliminar la categoría')
        }
      },
    })
  }

  const displayed = showInactive
    ? categories
    : categories.filter((c) => c.active)

  const columns: ColumnsType<ProductCategory> = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Familia',
      dataIndex: 'familyName',
      key: 'familyName',
      width: 160,
      render: (v: string) => (
        <Tag icon={<AppstoreOutlined />} color="blue">{v}</Tag>
      ),
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null) =>
        v ? <Text type="secondary">{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Productos',
      dataIndex: 'productCount',
      key: 'productCount',
      width: 100,
      align: 'center',
      render: (v: number) => (
        <Badge
          count={v}
          showZero
          style={{
            backgroundColor: v > 0 ? token.colorPrimary : token.colorTextQuaternary,
          }}
        />
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="success">Activa</Tag> : <Tag color="default">Inactiva</Tag>,
    },
    {
      title: 'Actualizado',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 130,
      render: (v: string) => (
        <Text style={{ fontSize: 12 }} type="secondary">
          {dayjs(v).format('DD/MM/YY HH:mm')}
        </Text>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_: unknown, record: ProductCategory) => (
        <Space size={4}>
          <Tooltip title="Editar">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.productCount > 0 ? 'Tiene productos asociados' : 'Eliminar'}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Categorías"
        subtitle="Gestiona las categorías del catálogo de productos"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Categorías' }]}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadCategories}
              loading={isLoading}
            >
              Actualizar
            </Button>
            <Button
              icon={<AppstoreOutlined />}
              onClick={handleOpenCreateFamily}
            >
              Nueva familia
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
            >
              Nueva categoría
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="¿Qué son las Categorías?"
        description="Organiza el catálogo de productos en familias y categorías. Una buena clasificación facilita la búsqueda en el Punto de Venta y enriquece los reportes de ventas por categoría."
      />

      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
        extra={
          <Space>
            <Text type="secondary">Mostrar inactivas</Text>
            <Switch
              size="small"
              checked={showInactive}
              onChange={setShowInactive}
            />
          </Space>
        }
        title={
          <Text strong>
            {displayed.length} categoría{displayed.length !== 1 ? 's' : ''}
          </Text>
        }
      >
        <Table
          columns={columns}
          dataSource={displayed}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} categorías` }}
        />
      </Card>

      {/* Sección de familias */}
      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
          marginTop: 16,
        }}
        title={<Text strong>Familias ({families.length})</Text>}
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={handleOpenCreateFamily}>
            Nueva
          </Button>
        }
      >
        <Table
          dataSource={families}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: 'Código', dataIndex: 'code', key: 'code', width: 90, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
            { title: 'Nombre', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
            { title: 'Descripción', dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string | null) => v ? <Text type="secondary">{v}</Text> : <Text type="secondary">—</Text> },
            { title: 'Estado', dataIndex: 'active', key: 'active', width: 90, align: 'center' as const, render: (v: boolean) => v ? <Tag color="success">Activa</Tag> : <Tag color="default">Inactiva</Tag> },
            {
              title: 'Acciones', key: 'actions', width: 80, align: 'center' as const,
              render: (_: unknown, record: ProductFamily) => (
                <Tooltip title="Editar">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEditFamily(record)} />
                </Tooltip>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        okText={editingCategory ? 'Guardar cambios' : 'Crear categoría'}
        cancelText="Cancelar"
        confirmLoading={isSubmitting}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label="Familia"
            name="familyId"
            rules={[{ required: true, message: 'Selecciona una familia' }]}
          >
            <Select
              placeholder="Seleccionar familia..."
              options={families.filter(f => f.active).map((f) => ({ value: f.id, label: f.name }))}
            />
          </Form.Item>

          <Form.Item
            label="Código"
            name="code"
            rules={[
              { required: true, message: 'Ingresa un código' },
              { max: 20, message: 'Máximo 20 caracteres' },
              {
                pattern: /^[A-Z0-9_]+$/i,
                message: 'Solo letras, números y guión bajo',
              },
            ]}
          >
            <Input
              placeholder="Ej: LAC, CER, CON_ALI"
              style={{ textTransform: 'uppercase' }}
              onChange={(e) =>
                form.setFieldValue('code', e.target.value.toUpperCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="Nombre"
            name="name"
            rules={[
              { required: true, message: 'Ingresa un nombre' },
              { max: 100, message: 'Máximo 100 caracteres' },
            ]}
          >
            <Input placeholder="Ej: Lácteos, Cereales y Pastas" />
          </Form.Item>

          <Form.Item
            label="Descripción"
            name="description"
            rules={[{ max: 500, message: 'Máximo 500 caracteres' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Descripción opcional de la categoría..."
            />
          </Form.Item>

          <Form.Item
            label="Activa"
            name="active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal familia */}
      <Modal
        title={editingFamily ? 'Editar familia' : 'Nueva familia'}
        open={familyModalOpen}
        onCancel={() => {
          setFamilyModalOpen(false)
          familyForm.resetFields()
        }}
        onOk={() => familyForm.submit()}
        okText={editingFamily ? 'Guardar cambios' : 'Crear familia'}
        cancelText="Cancelar"
        confirmLoading={isFamilySubmitting}
        forceRender
      >
        <Form
          form={familyForm}
          layout="vertical"
          onFinish={handleFamilySubmit}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label="Código"
            name="code"
            rules={[
              { required: true, message: 'Ingresa un código' },
              { max: 20, message: 'Máximo 20 caracteres' },
              { pattern: /^[A-Z0-9_]+$/i, message: 'Solo letras, números y guión bajo' },
            ]}
          >
            <Input
              placeholder="Ej: ALI, BEB, LIM"
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => familyForm.setFieldValue('code', e.target.value.toUpperCase())}
            />
          </Form.Item>

          <Form.Item
            label="Nombre"
            name="name"
            rules={[
              { required: true, message: 'Ingresa un nombre' },
              { max: 100, message: 'Máximo 100 caracteres' },
            ]}
          >
            <Input placeholder="Ej: Alimentos, Bebidas, Limpieza" />
          </Form.Item>

          <Form.Item
            label="Descripción"
            name="description"
            rules={[{ max: 500, message: 'Máximo 500 caracteres' }]}
          >
            <Input.TextArea rows={2} placeholder="Descripción opcional..." />
          </Form.Item>

          <Form.Item label="Activa" name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CategoriesPage
