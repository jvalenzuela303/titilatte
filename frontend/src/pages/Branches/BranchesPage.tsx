import React, { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Typography,
  Card,
  Row,
  Col,
  Tooltip,
  App,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { branchService } from '@/services/branchService'
import type { Branch, BranchRequest } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'

const { Title, Text } = Typography

// ── RUT formatter ──────────────────────────────────────────────────────────────
// Displays a raw RUT string with dots and dash if it looks like a valid Chilean RUT.
// Raw format accepted: "12345678K" or already formatted "12.345.678-K".
function formatRut(raw: string | null): string {
  if (!raw) return '—'
  // Strip existing formatting
  const clean = raw.replace(/[.\-]/g, '').toUpperCase()
  if (clean.length < 2) return raw
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  // Insert thousands dots
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

// ── Component ─────────────────────────────────────────────────────────────────

const BranchesPage: React.FC = () => {
  const { isAdmin } = useAuth()

  const { message } = App.useApp()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)

  const [form] = Form.useForm<BranchRequest>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await branchService.findAll()
      setBranches(res.data)
    } catch {
      void message.error('Error al cargar las sucursales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBranches()
  }, [fetchBranches])

  // ── Modal open/close ───────────────────────────────────────────────────────

  const openModal = (branch?: Branch) => {
    setEditingBranch(branch ?? null)
    if (branch) {
      form.setFieldsValue({
        name: branch.name,
        address: branch.address ?? undefined,
        phone: branch.phone ?? undefined,
        rut: branch.rut ?? undefined,
      })
    } else {
      form.resetFields()
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    form.resetFields()
    setEditingBranch(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editingBranch) {
        await branchService.update(editingBranch.id, values)
        void message.success('Sucursal actualizada exitosamente')
      } else {
        await branchService.create(values)
        void message.success('Sucursal creada exitosamente')
      }
      closeModal()
      void fetchBranches()
    } catch (err: unknown) {
      // Ant Design validation errors have errorFields — skip the API error toast
      if (err && typeof err === 'object' && 'errorFields' in err) return
      void message.error('Error al guardar la sucursal')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  const handleDeactivate = (branch: Branch) => {
    Modal.confirm({
      title: 'Desactivar sucursal',
      content: (
        <span>
          Esta accion desactivara la sucursal <strong>{branch.name}</strong>. Los
          usuarios asignados a ella no podran operar. &iquest;Confirmar?
        </span>
      ),
      okText: 'Desactivar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await branchService.deactivate(branch.id)
          void message.success(`Sucursal "${branch.name}" desactivada`)
          void fetchBranches()
        } catch {
          void message.error('Error al desactivar la sucursal')
        }
      },
    })
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: ColumnsType<Branch> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Direccion',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'RUT',
      dataIndex: 'rut',
      key: 'rut',
      width: 140,
      render: (v: string | null) =>
        v ? <Text>{formatRut(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Telefono',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            width: 100,
            render: (_: unknown, record: Branch) => (
              <Space size="small">
                <Tooltip title="Editar sucursal">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openModal(record)}
                    aria-label={`Editar ${record.name}`}
                  />
                </Tooltip>
                {record.isActive && (
                  <Tooltip title="Desactivar sucursal">
                    <Button
                      size="small"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => handleDeactivate(record)}
                      aria-label={`Desactivar ${record.name}`}
                    />
                  </Tooltip>
                )}
              </Space>
            ),
          } as ColumnsType<Branch>[number],
        ]
      : []),
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <ApartmentOutlined style={{ marginRight: 8 }} />
            Sucursales
          </Title>
          <Text type="secondary">Gestion de sucursales de la empresa</Text>
        </Col>
        {isAdmin && (
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
            >
              Nueva Sucursal
            </Button>
          </Col>
        )}
      </Row>

      <Card>
        <Table<Branch>
          rowKey="id"
          dataSource={branches}
          columns={columns}
          loading={loading}
          pagination={false}
          scroll={{ x: 700 }}
          locale={{ emptyText: 'No hay sucursales registradas' }}
        />
      </Card>

      {/* Modal crear / editar */}
      <Modal
        title={editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        okText={editingBranch ? 'Guardar Cambios' : 'Crear Sucursal'}
        cancelText="Cancelar"
        confirmLoading={submitting}
        forceRender
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label="Nombre"
            rules={[
              { required: true, message: 'El nombre es requerido' },
              { max: 100, message: 'Maximo 100 caracteres' },
            ]}
          >
            <Input placeholder="Ej: Sucursal Centro" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="address"
            label="Direccion"
            rules={[{ max: 200, message: 'Maximo 200 caracteres' }]}
          >
            <Input placeholder="Ej: Av. Principal 123, Santiago" maxLength={200} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Telefono"
                rules={[{ max: 20, message: 'Maximo 20 caracteres' }]}
              >
                <Input placeholder="Ej: +56212345678" maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="rut"
                label="RUT"
                rules={[
                  { max: 12, message: 'Maximo 12 caracteres' },
                  {
                    pattern: /^[\d]{1,2}\.?[\d]{3}\.?[\d]{3}-?[\dkK]$/,
                    message: 'Formato invalido (ej: 76.543.210-K)',
                  },
                ]}
              >
                <Input placeholder="Ej: 76.543.210-K" maxLength={12} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default BranchesPage
