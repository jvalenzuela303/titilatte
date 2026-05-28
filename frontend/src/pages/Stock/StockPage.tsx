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
  Card,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  theme,
  Spin,
  App,
} from 'antd'
import {
  WarningOutlined,
  ReloadOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import stockService from '@/services/stockService'
import productService from '@/services/productService'
import { useAuth } from '@/hooks/useAuth'
import type { StockEntry, StockMovement, StockStatus, Product } from '@/types'

const { Text } = Typography

function computeStatus(current: number, minimum: number, maximum: number | null): StockStatus {
  if (current <= 0) return 'CRITICAL'
  if (current <= minimum) return 'LOW'
  if (maximum != null && current >= maximum) return 'OVERSTOCK'
  return 'OK'
}

const statusConfig: Record<StockStatus, { color: string; label: string }> = {
  OK: { color: 'green', label: 'OK' },
  LOW: { color: 'orange', label: 'Bajo' },
  CRITICAL: { color: 'red', label: 'Crítico' },
  OVERSTOCK: { color: 'blue', label: 'Sobrestock' },
}

const movementTypeConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  ENTRY: { color: 'green', icon: <ArrowUpOutlined /> },
  EXIT: { color: 'red', icon: <ArrowDownOutlined /> },
  ADJUSTMENT: { color: 'blue', icon: <ReloadOutlined /> },
  SALE: { color: 'orange', icon: <ArrowDownOutlined /> },
  RETURN: { color: 'cyan', icon: <ArrowUpOutlined /> },
}

interface AdjustmentFormValues {
  productId: string
  quantity: number
  notes: string
}

const StockPage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { isAdmin, isSupervisor } = useAuth()
  const canAdjust = isAdmin || isSupervisor

  const [stockList, setStockList] = useState<StockEntry[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [movementTotal, setMovementTotal] = useState(0)
  const [movementPage, setMovementPage] = useState(1)
  const [isLoadingStock, setIsLoadingStock] = useState(false)
  const [isLoadingMovements, setIsLoadingMovements] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [activeTab, setActiveTab] = useState('stock')

  const [form] = Form.useForm<AdjustmentFormValues>()

  const loadStock = useCallback(async () => {
    setIsLoadingStock(true)
    try {
      const res = await stockService.getStock()
      const withStatus = res.data.content.map((p) => ({
        ...p,
        status: computeStatus(p.stockCurrent, p.stockMinimum, p.stockMaximum),
      }))
      setStockList(withStatus)
    } catch {
      message.error('Error al cargar el stock')
    } finally {
      setIsLoadingStock(false)
    }
  }, [])

  const loadMovements = useCallback(async (page = 1) => {
    setIsLoadingMovements(true)
    try {
      const res = await stockService.getMovements(page - 1, 20)
      setMovements(res.data.content)
      setMovementTotal(res.data.totalElements)
      setMovementPage(page)
    } catch {
      message.error('Error al cargar los movimientos')
    } finally {
      setIsLoadingMovements(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const res = await productService.getProducts({ size: 200, active: true })
      setProducts(res.data.content)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements(1)
    }
  }, [activeTab, loadMovements])

  const handleOpenAdjustModal = async () => {
    await loadProducts()
    setAdjustModalOpen(true)
  }

  const handleAdjustSubmit = async (values: AdjustmentFormValues) => {
    setIsSubmitting(true)
    try {
      await stockService.createAdjustment({
        productId: values.productId,
        quantity: values.quantity,
        notes: values.notes,
      })
      message.success('Ajuste de stock registrado exitosamente')
      setAdjustModalOpen(false)
      form.resetFields()
      loadStock()
    } catch {
      message.error('Error al registrar el ajuste')
    } finally {
      setIsSubmitting(false)
    }
  }

  // KPIs
  const lowCount = stockList.filter((s) => s.status === 'LOW' || s.status === 'CRITICAL').length
  const criticalCount = stockList.filter((s) => s.status === 'CRITICAL').length
  const okCount = stockList.filter((s) => s.status === 'OK').length

  const stockColumns: ColumnsType<StockEntry> = [
    {
      title: 'Código',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Producto',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Stock Actual',
      dataIndex: 'stockCurrent',
      key: 'stockCurrent',
      width: 110,
      align: 'center',
      render: (v: number, record: StockEntry) => {
        const isCritical = record.status === 'CRITICAL'
        const isLow = record.status === 'LOW'
        return (
          <Text
            strong
            style={{
              fontSize: 16,
              color: isCritical
                ? token.colorError
                : isLow
                ? token.colorWarning
                : token.colorSuccess,
            }}
          >
            {v}
          </Text>
        )
      },
    },
    {
      title: 'Mín',
      dataIndex: 'stockMinimum',
      key: 'stockMinimum',
      width: 70,
      align: 'center',
      render: (v: number) => <Text type="secondary">{v}</Text>,
    },
    {
      title: 'Máx',
      dataIndex: 'stockMaximum',
      key: 'stockMaximum',
      width: 70,
      align: 'center',
      render: (v: number) => <Text type="secondary">{v ?? '—'}</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (v: StockEntry['status']) => {
        const cfg = statusConfig[v]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
  ]

  const movementColumns: ColumnsType<StockMovement> = [
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => (
        <Text style={{ fontSize: 12 }}>
          {dayjs(v).format('DD/MM/YYYY HH:mm')}
        </Text>
      ),
    },
    {
      title: 'Producto',
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (v: string) => {
        const cfg = movementTypeConfig[v] ?? { color: 'default', icon: null }
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {v}
          </Tag>
        )
      },
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? token.colorSuccess : token.colorError }}>
          {v > 0 ? `+${v}` : v}
        </Text>
      ),
    },
    {
      title: 'Stock Anterior',
      dataIndex: 'previousStock',
      key: 'previousStock',
      width: 110,
      align: 'center',
    },
    {
      title: 'Stock Nuevo',
      dataIndex: 'newStock',
      key: 'newStock',
      width: 110,
      align: 'center',
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: 'Notas',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'Usuario',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 130,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Control de Stock"
        subtitle="Monitorea inventario y registra ajustes"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Stock' }]}
        extra={
          canAdjust && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenAdjustModal}
            >
              Ajuste de Stock
            </Button>
          )
        }
      />

      {/* KPI summary */}
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
              title="Stock OK"
              value={okCount}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            variant="borderless"
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              borderLeft: `4px solid ${token.colorWarning}`,
            }}
          >
            <Statistic
              title="Stock Bajo"
              value={lowCount}
              valueStyle={{ color: token.colorWarning }}
              prefix={lowCount > 0 ? <WarningOutlined /> : null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            variant="borderless"
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              borderLeft: `4px solid ${token.colorError}`,
            }}
          >
            <Statistic
              title="Stock Crítico (agotado)"
              value={criticalCount}
              valueStyle={{ color: token.colorError }}
              prefix={criticalCount > 0 ? <WarningOutlined /> : null}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
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
              key: 'stock',
              label: 'Inventario actual',
              children: (
                <Spin spinning={isLoadingStock}>
                  <div style={{ marginBottom: 12 }}>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadStock}
                      size="small"
                    >
                      Actualizar
                    </Button>
                  </div>
                  <Table
                    columns={stockColumns}
                    dataSource={stockList}
                    rowKey="productId"
                    scroll={{ x: 700 }}
                    pagination={{ pageSize: 20, showTotal: (t) => `${t} productos` }}
                    rowClassName={(record) =>
                      record.status === 'CRITICAL'
                        ? 'ant-table-row-danger'
                        : record.status === 'LOW'
                        ? 'ant-table-row-warning'
                        : ''
                    }
                  />
                </Spin>
              ),
            },
            {
              key: 'movements',
              label: 'Historial de movimientos',
              children: (
                <Table
                  columns={movementColumns}
                  dataSource={movements}
                  rowKey="id"
                  loading={isLoadingMovements}
                  scroll={{ x: 900 }}
                  pagination={{
                    current: movementPage,
                    pageSize: 20,
                    total: movementTotal,
                    onChange: (page) => loadMovements(page),
                    showTotal: (t) => `${t} movimientos`,
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Adjustment Modal */}
      <Modal
        title="Ajuste de Stock"
        open={adjustModalOpen}
        onCancel={() => {
          setAdjustModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        okText="Registrar ajuste"
        cancelText="Cancelar"
        confirmLoading={isSubmitting}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdjustSubmit}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label="Producto"
            name="productId"
            rules={[{ required: true, message: 'Selecciona un producto' }]}
          >
            <Select
              showSearch
              placeholder="Buscar producto..."
              optionFilterProp="label"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.barcode}) — Stock: ${p.stockCurrent}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Cantidad a ajustar (positivo = entrada, negativo = salida)"
            name="quantity"
            rules={[
              { required: true, message: 'Ingresa la cantidad' },
              { type: 'number', message: 'Debe ser un número' },
              {
                validator: (_, value) =>
                  value !== 0
                    ? Promise.resolve()
                    : Promise.reject('La cantidad no puede ser 0'),
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Ej: 10 para entrada, -5 para salida"
            />
          </Form.Item>

          <Form.Item
            label="Notas / Motivo"
            name="notes"
            rules={[
              { required: true, message: 'Ingresa el motivo del ajuste' },
              { min: 5, message: 'El motivo debe tener al menos 5 caracteres' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Ej: Inventario físico 2024, merma, devolución a proveedor..."
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .ant-table-row-danger > td {
          background-color: ${token.colorErrorBg} !important;
        }
        .ant-table-row-warning > td {
          background-color: ${token.colorWarningBg} !important;
        }
      `}</style>
    </div>
  )
}

export default StockPage
