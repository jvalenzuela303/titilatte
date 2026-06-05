import React, { useEffect, useState } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Descriptions,
  Skeleton,
  Space,
  Typography,
  App,
  theme,
  Divider,
} from 'antd'
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  IdcardOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/common/PageHeader'
import { branchService, type Branch, type BranchRequest } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'

const { Text } = Typography

const STORE_ID = '00000000-0000-0000-0000-000000000001'

const StoreConfigPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { isAdmin } = useAuth()

  const [store, setStore] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form] = Form.useForm<BranchRequest>()

  useEffect(() => {
    branchService
      .findById(STORE_ID)
      .then((res) => setStore(res.data))
      .catch(() => message.error('No se pudo cargar la información de la tienda'))
      .finally(() => setLoading(false))
  }, [])

  const handleEdit = () => {
    if (!store) return
    form.setFieldsValue({
      name: store.name,
      address: store.address ?? '',
      phone: store.phone ?? '',
      rut: store.rut ?? '',
    })
    setEditing(true)
  }

  const handleCancel = () => {
    form.resetFields()
    setEditing(false)
  }

  const handleSave = async () => {
    let values: BranchRequest
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setSaving(true)
    try {
      const res = await branchService.update(STORE_ID, values)
      setStore(res.data)
      setEditing(false)
      message.success('Datos de la tienda actualizados')
    } catch {
      message.error('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const editButton = isAdmin ? (
    <Button icon={<EditOutlined />} onClick={handleEdit}>
      Editar
    </Button>
  ) : null

  return (
    <>
      <PageHeader
        title="Configuración de tienda"
        subtitle="Información general del local"
        breadcrumbs={[{ title: 'Administración' }, { title: 'Configuración de tienda' }]}
        extra={!editing ? editButton : null}
      />

      <Row gutter={[24, 24]}>
        {/* ── Datos actuales / formulario ───────────────────────────────────── */}
        <Col xs={24} lg={16}>
          <Card
            style={{ borderRadius: token.borderRadiusLG }}
            styles={{ body: { padding: 24 } }}
          >
            {/* Cabecera de la tarjeta */}
            <Space align="center" style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: token.borderRadiusLG,
                  background: token.colorPrimaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShopOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
              </div>
              <div>
                {loading ? (
                  <Skeleton.Input active size="small" style={{ width: 180 }} />
                ) : (
                  <>
                    <Text strong style={{ fontSize: 16, display: 'block' }}>
                      {store?.name ?? '—'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      RUT: {store?.rut ?? 'No registrado'}
                    </Text>
                  </>
                )}
              </div>
            </Space>

            <Divider style={{ margin: '0 0 20px' }} />

            {/* Vista lectura */}
            {!editing && (
              <>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <Descriptions column={1} size="middle" labelStyle={{ width: 160, color: token.colorTextSecondary }}>
                    <Descriptions.Item
                      label={
                        <Space size={6}>
                          <ShopOutlined />
                          Nombre
                        </Space>
                      }
                    >
                      {store?.name ?? '—'}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <Space size={6}>
                          <IdcardOutlined />
                          RUT
                        </Space>
                      }
                    >
                      {store?.rut ?? <Text type="secondary">No registrado</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <Space size={6}>
                          <EnvironmentOutlined />
                          Dirección
                        </Space>
                      }
                    >
                      {store?.address ?? <Text type="secondary">No registrada</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <Space size={6}>
                          <PhoneOutlined />
                          Teléfono
                        </Space>
                      }
                    >
                      {store?.phone ?? <Text type="secondary">No registrado</Text>}
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </>
            )}

            {/* Vista edición */}
            {editing && (
              <Form form={form} layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} md={16}>
                    <Form.Item
                      name="name"
                      label="Nombre de la tienda"
                      rules={[
                        { required: true, message: 'El nombre es obligatorio' },
                        { max: 100, message: 'Máximo 100 caracteres' },
                      ]}
                    >
                      <Input prefix={<ShopOutlined />} placeholder="Ej: Minimarket El Sol" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="rut"
                      label="RUT del contribuyente"
                      rules={[{ max: 12, message: 'Máximo 12 caracteres' }]}
                    >
                      <Input prefix={<IdcardOutlined />} placeholder="Ej: 76543210-9" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      name="address"
                      label="Dirección"
                      rules={[{ max: 200, message: 'Máximo 200 caracteres' }]}
                    >
                      <Input prefix={<EnvironmentOutlined />} placeholder="Ej: Av. Principal 123, Santiago" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="phone"
                      label="Teléfono"
                      rules={[{ max: 20, message: 'Máximo 20 caracteres' }]}
                    >
                      <Input prefix={<PhoneOutlined />} placeholder="Ej: +56 2 1234 5678" />
                    </Form.Item>
                  </Col>
                </Row>

                <Space style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                  >
                    Guardar cambios
                  </Button>
                  <Button icon={<CloseOutlined />} onClick={handleCancel} disabled={saving}>
                    Cancelar
                  </Button>
                </Space>
              </Form>
            )}
          </Card>
        </Col>

        {/* ── Panel informativo ─────────────────────────────────────────────── */}
        <Col xs={24} lg={8}>
          <Card
            style={{ borderRadius: token.borderRadiusLG, background: token.colorFillAlter, border: `1px solid ${token.colorBorderSecondary}` }}
            styles={{ body: { padding: 20 } }}
          >
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              Sobre estos datos
            </Text>
            <Space direction="vertical" size={10}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                El <strong>nombre</strong> aparece en los tickets de venta impresos.
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                El <strong>RUT</strong> es el RUT tributario del negocio (ej: 76.543.210-9).
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                La <strong>dirección</strong> y el <strong>teléfono</strong> se muestran en documentos y comprobantes.
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  )
}

export default StoreConfigPage
