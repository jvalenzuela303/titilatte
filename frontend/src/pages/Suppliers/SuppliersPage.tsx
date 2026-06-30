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
  Switch,
  Typography,
  Card,
  Row,
  Col,
  Tooltip,
  App,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import { purchaseService } from '@/services/purchaseService'
import type { Supplier } from '@/types'
import { useAuth } from '@/hooks/useAuth'

const { Text } = Typography

const SuppliersPage: React.FC = () => {
  const { hasRole } = useAuth()
  const canEdit = hasRole('ADMIN', 'SUPERVISOR')

  const { message } = App.useApp()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('true')

  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchSuppliers = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage - 1,
          size: pageSize,
        }
        if (search) params.search = search
        if (activeFilter !== 'all') params.active = activeFilter
        const res = await purchaseService.getSuppliers(params)
        setSuppliers(res.data.content ?? [])
        setTotal(res.data.totalElements ?? 0)
      } catch {
        message.error('Error al cargar los proveedores')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, search, activeFilter],
  )

  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    } else {
      fetchSuppliers(1)
    }
  }, [search, activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSuppliers(page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleReset = () => {
    setSearchInput('')
    setSearch('')
    setActiveFilter('true')
    setPage(1)
  }

  // ── Modales ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingSupplier(null)
    form.resetFields()
    form.setFieldsValue({ active: true })
    setModalOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    form.setFieldsValue({
      name: supplier.name,
      rut: supplier.rut ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      contactName: supplier.contactName ?? '',
      active: supplier.active,
    })
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    form.resetFields()
    setEditingSupplier(null)
  }

  const handleSubmit = async () => {
    let values: Record<string, unknown>
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSubmitting(true)
    try {
      const payload: Partial<Supplier> = {
        name: values.name as string,
        rut: (values.rut as string) || undefined,
        email: (values.email as string) || undefined,
        phone: (values.phone as string) || undefined,
        address: (values.address as string) || undefined,
        contactName: (values.contactName as string) || undefined,
        ...(editingSupplier ? { active: values.active as boolean } : {}),
      }
      if (editingSupplier) {
        await purchaseService.updateSupplier(editingSupplier.id, payload)
        message.success('Proveedor actualizado')
      } else {
        await purchaseService.createSupplier(payload)
        message.success('Proveedor creado exitosamente')
      }
      handleModalClose()
      fetchSuppliers(page)
    } catch {
      message.error('Error al guardar el proveedor')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Columnas ────────────────────────────────────────────────────────────────

  const columns: ColumnsType<Supplier> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'RUT',
      dataIndex: 'rut',
      key: 'rut',
      width: 140,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Teléfono',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Contacto',
      dataIndex: 'contactName',
      key: 'contactName',
      width: 160,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Dirección',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>
      ),
    },
    ...(canEdit
      ? ([
          {
            title: 'Acciones',
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_: unknown, record: Supplier) => (
              <Space size="small">
                <Tooltip title="Editar proveedor">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(record)}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ] as ColumnsType<Supplier>)
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Gestiona el directorio de proveedores del minimarket"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Proveedores' }]}
        extra={
          canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nuevo Proveedor
            </Button>
          )
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="¿Qué es el módulo de Proveedores?"
        description="Administra el directorio de proveedores: nombre, RUT, contacto y condiciones comerciales. Los proveedores están vinculados a las órdenes de compra del sistema."
      />

      {/* Filtros */}
      <Card variant="borderless" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Buscar por nombre o RUT"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              onClear={handleReset}
            />
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              value={activeFilter}
              onChange={(v) => setActiveFilter(v)}
              options={[
                { value: 'true', label: 'Solo Activos' },
                { value: 'false', label: 'Solo Inactivos' },
                { value: 'all', label: 'Todos' },
              ]}
            />
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                Buscar
              </Button>
              <Button onClick={handleReset}>Limpiar</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabla */}
      <Card variant="borderless">
        <Table
          rowKey="id"
          dataSource={suppliers}
          columns={columns}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} proveedores`,
            onChange: setPage,
          }}
        />
      </Card>

      {/* Modal Crear / Editar */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </Space>
        }
        open={modalOpen}
        onCancel={handleModalClose}
        onOk={handleSubmit}
        okText={editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'}
        cancelText="Cancelar"
        confirmLoading={submitting}
        width={560}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="name"
                label="Nombre del proveedor"
                rules={[{ required: true, message: 'El nombre es requerido' }]}
              >
                <Input placeholder="Distribuidora XYZ" autoFocus />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="rut"
                label="RUT"
                rules={[{ required: true, message: 'El RUT es requerido' }]}
              >
                <Input placeholder="76.543.210-K" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Teléfono">
                <Input placeholder="+56 9 1234 5678" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Ingresa un email válido' }]}
              >
                <Input placeholder="contacto@proveedor.cl" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Dirección">
            <Input placeholder="Av. Principal 1234, Santiago" />
          </Form.Item>
          <Form.Item name="contactName" label="Persona de contacto">
            <Input placeholder="Nombre del ejecutivo de ventas" />
          </Form.Item>
          {editingSupplier && (
            <Form.Item name="active" label="Estado" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default SuppliersPage
