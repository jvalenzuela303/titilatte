import React, { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Space,
  Select,
  DatePicker,
  Modal,
  Typography,
  Descriptions,
  Row,
  Col,
  Card,
  Tooltip,
  App,
} from 'antd'
import {
  PlusOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { purchaseService } from '@/services/purchaseService'
import type { Purchase, PurchaseItem } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import PurchaseForm from './PurchaseForm'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const statusColor: Record<Purchase['status'], string> = {
  DRAFT: 'default',
  CONFIRMED: 'success',
  CANCELLED: 'error',
}

const statusLabel: Record<Purchase['status'], string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
}

const docTypeLabel: Record<Purchase['documentType'], string> = {
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  SIN_DOCUMENTO: 'Sin Doc.',
}

const PurchasesPage: React.FC = () => {
  const { hasRole } = useAuth()
  // SECURITY: only ADMIN and SUPERVISOR can confirm purchases (mirrors backend @PreAuthorize).
  // BODEGA was incorrectly listed here — they can create DRAFTs but not confirm them.
  const canConfirm = hasRole('ADMIN', 'SUPERVISOR')

  const { message } = App.useApp()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null)

  const fetchPurchases = useCallback(
    async (currentPage = page) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage - 1,
          size: pageSize,
          sort: 'createdAt,desc',
        }
        if (statusFilter) params.status = statusFilter
        if (dateRange) {
          params.startDate = dateRange[0].format('YYYY-MM-DD')
          params.endDate = dateRange[1].format('YYYY-MM-DD')
        }
        const res = await purchaseService.getAll(params)
        setPurchases(res.data.content)
        setTotal(res.data.totalElements)
      } catch {
        message.error('Error al cargar las compras')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize, statusFilter, dateRange],
  )

  useEffect(() => {
    setPage(1)
    fetchPurchases(1)
  }, [statusFilter, dateRange]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPurchases(page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = (record: Purchase) => {
    Modal.confirm({
      title: 'Confirmar Compra',
      icon: <ExclamationCircleOutlined />,
      content: `¿Confirmar la compra N° ${record.purchaseNumber}? Esto actualizará el stock de los productos.`,
      okText: 'Confirmar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await purchaseService.confirm(record.id)
          message.success('Compra confirmada exitosamente')
          fetchPurchases(page)
        } catch {
          message.error('Error al confirmar la compra')
        }
      },
    })
  }

  const handleViewDetail = async (record: Purchase) => {
    try {
      const res = await purchaseService.getById(record.id)
      setDetailPurchase(res.data)
    } catch {
      message.error('Error al cargar el detalle')
    }
  }

  const itemColumns: ColumnsType<PurchaseItem> = [
    { title: 'Producto', dataIndex: 'productName', key: 'productName' },
    { title: 'Cantidad', dataIndex: 'quantity', key: 'quantity', align: 'right' },
    {
      title: 'Costo Unit.',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right',
      render: (v: number) =>
        `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}`,
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      align: 'right',
      render: (v: number) =>
        `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}`,
    },
    {
      title: 'Costo Anterior',
      dataIndex: 'previousCost',
      key: 'previousCost',
      align: 'right',
      render: (v?: number) =>
        v != null ? `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}` : '—',
    },
    {
      title: 'Nuevo Costo Prom.',
      dataIndex: 'newAvgCost',
      key: 'newAvgCost',
      align: 'right',
      render: (v?: number) =>
        v != null ? `$${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}` : '—',
    },
  ]

  const columns: ColumnsType<Purchase> = [
    {
      title: 'N° Compra',
      dataIndex: 'purchaseNumber',
      key: 'purchaseNumber',
      width: 110,
      render: (v: number) => <Text strong>#{v}</Text>,
    },
    {
      title: 'Proveedor',
      dataIndex: 'supplierName',
      key: 'supplierName',
      render: (v?: string) => v ?? <Text type="secondary">Sin proveedor</Text>,
    },
    {
      title: 'Tipo Doc.',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 110,
      render: (v: Purchase['documentType']) => docTypeLabel[v],
    },
    {
      title: 'Monto Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      width: 130,
      render: (v: number) => (
        <Text strong>
          ${v.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: Purchase['status']) => (
        <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Registrado por',
      dataIndex: 'purchasedByEmail',
      key: 'purchasedByEmail',
      ellipsis: true,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Space size="small">
          {canConfirm && record.status === 'DRAFT' && (
            <Tooltip title="Confirmar compra">
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Compras
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setFormOpen(true)}
          >
            Nueva Compra
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Filtrar por estado"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'DRAFT', label: 'Borrador' },
              { value: 'CONFIRMED', label: 'Confirmado' },
              { value: 'CANCELLED', label: 'Cancelado' },
            ]}
          />
          <RangePicker
            format="DD/MM/YYYY"
            value={dateRange}
            onChange={(vals) =>
              setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)
            }
          />
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={purchases}
          columns={columns}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} compras`,
            onChange: setPage,
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Nueva Compra Modal */}
      <PurchaseForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          setFormOpen(false)
          fetchPurchases(page)
        }}
      />

      {/* Detalle Modal */}
      <Modal
        title={
          detailPurchase
            ? `Compra #${detailPurchase.purchaseNumber}`
            : 'Detalle de Compra'
        }
        open={!!detailPurchase}
        onCancel={() => setDetailPurchase(null)}
        footer={
          <Button onClick={() => setDetailPurchase(null)}>Cerrar</Button>
        }
        width={780}
        destroyOnHidden
      >
        {detailPurchase && (
          <>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label="Proveedor">
                {detailPurchase.supplierName ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tipo Documento">
                {docTypeLabel[detailPurchase.documentType]}
              </Descriptions.Item>
              <Descriptions.Item label="N° Documento">
                {detailPurchase.documentNumber ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={statusColor[detailPurchase.status]}>
                  {statusLabel[detailPurchase.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Fecha Compra">
                {dayjs(detailPurchase.purchaseDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Monto Total">
                <Text strong>
                  $
                  {detailPurchase.totalAmount.toLocaleString('es-CL', {
                    minimumFractionDigits: 0,
                  })}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por" span={2}>
                {detailPurchase.purchasedByEmail}
              </Descriptions.Item>
              {detailPurchase.notes && (
                <Descriptions.Item label="Notas" span={2}>
                  {detailPurchase.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>
              Productos
            </Title>
            <Table
              rowKey="id"
              dataSource={detailPurchase.items}
              columns={itemColumns}
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
            />
          </>
        )}
      </Modal>
    </div>
  )
}

export default PurchasesPage
