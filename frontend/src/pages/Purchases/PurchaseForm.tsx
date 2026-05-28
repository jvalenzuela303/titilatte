import React, { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  Button,
  Table,
  InputNumber,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  App,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { purchaseService } from '@/services/purchaseService'
import { useProducts } from '@/hooks/useProducts'
import type { Supplier, CreatePurchaseRequest } from '@/types'

const { Text } = Typography
const { TextArea } = Input

interface PurchaseFormItem {
  key: string
  productId: string
  productName: string
  quantity: number
  unitCost: number
  subtotal: number
}

interface PurchaseFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const docTypeOptions = [
  { value: 'FACTURA', label: 'Factura' },
  { value: 'BOLETA', label: 'Boleta' },
  { value: 'SIN_DOCUMENTO', label: 'Sin Documento' },
]

const PurchaseForm: React.FC<PurchaseFormProps> = ({ open, onClose, onSuccess }) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<PurchaseFormItem[]>([])
  const { products, loading: productsLoading, getProducts } = useProducts()

  useEffect(() => {
    if (open) {
      getProducts({ size: 200, active: true })
      loadSuppliers()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSuppliers = async () => {
    setSuppliersLoading(true)
    try {
      const res = await purchaseService.getSuppliers()
      setSuppliers(res.data.content ?? [])
    } catch {
      // suppliers are optional — non-fatal
    } finally {
      setSuppliersLoading(false)
    }
  }

  const totalAmount = items.reduce((acc, i) => acc + i.subtotal, 0)

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productId: '',
        productName: '',
        quantity: 1,
        unitCost: 0,
        subtotal: 0,
      },
    ])
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  const updateItem = useCallback(
    (key: string, field: Partial<PurchaseFormItem>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item
          const updated = { ...item, ...field }
          if (field.productId !== undefined) {
            const found = products.find((p) => p.id === field.productId)
            updated.productName = found?.name ?? ''
            updated.unitCost = found?.purchasePrice ?? 0
          }
          updated.subtotal = (updated.quantity ?? 0) * (updated.unitCost ?? 0)
          return updated
        }),
      )
    },
    [products],
  )

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (items.length === 0) {
        message.warning('Debes agregar al menos un producto')
        return
      }

      const invalidItem = items.find((i) => !i.productId || i.quantity <= 0 || i.unitCost <= 0)
      if (invalidItem) {
        message.warning('Completa todos los campos de los productos (producto, cantidad, costo)')
        return
      }

      const payload: CreatePurchaseRequest = {
        supplierId: values.supplierId,
        documentType: values.documentType,
        documentNumber: values.documentNumber,
        notes: values.notes,
        purchaseDate: values.purchaseDate
          ? dayjs(values.purchaseDate).format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      }

      setSubmitting(true)
      await purchaseService.create(payload)
      message.success('Compra creada en borrador')
      form.resetFields()
      setItems([])
      onSuccess()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return // validation error
      message.error('Error al crear la compra')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setItems([])
    onClose()
  }

  const columns: ColumnsType<PurchaseFormItem> = [
    {
      title: 'Producto',
      dataIndex: 'productId',
      width: '35%',
      render: (_, record) => (
        <Select
          showSearch
          placeholder="Buscar producto"
          value={record.productId || undefined}
          loading={productsLoading}
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          options={products.map((p) => ({
            value: p.id,
            label: `${p.name} (${p.barcode})`,
          }))}
          onChange={(val) => updateItem(record.key, { productId: val })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      width: '15%',
      render: (_, record) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={(val) => updateItem(record.key, { quantity: val ?? 1 })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Costo Unit.',
      dataIndex: 'unitCost',
      width: '20%',
      render: (_, record) => (
        <InputNumber
          min={0}
          step={0.01}
          prefix="$"
          value={record.unitCost}
          onChange={(val) => updateItem(record.key, { unitCost: val ?? 0 })}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      width: '20%',
      render: (_, record) => (
        <Text strong>${record.subtotal.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
          aria-label="Eliminar item"
        />
      ),
    },
  ]

  return (
    <Modal
      title="Nueva Compra"
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      okText="Crear Borrador"
      cancelText="Cancelar"
      confirmLoading={submitting}
      width={860}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" initialValues={{ purchaseDate: dayjs() }}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="supplierId" label="Proveedor">
              <Select
                placeholder="Seleccionar proveedor (opcional)"
                loading={suppliersLoading}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="documentType"
              label="Tipo de Documento"
              rules={[{ required: true, message: 'Selecciona el tipo de documento' }]}
            >
              <Select placeholder="Seleccionar tipo" options={docTypeOptions} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="documentNumber" label="N° Documento">
              <Input placeholder="Opcional" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="purchaseDate"
              label="Fecha de Compra"
              rules={[{ required: true, message: 'Selecciona la fecha' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={(d) => d.isAfter(dayjs())}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="notes" label="Notas">
          <TextArea rows={2} placeholder="Observaciones opcionales" />
        </Form.Item>
      </Form>

      <Divider orientation="left">Productos</Divider>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="key"
        pagination={false}
        size="small"
        locale={{ emptyText: 'Sin productos — agrega uno con el botón' }}
      />

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addItem}
        style={{ width: '100%', marginTop: 12 }}
      >
        Agregar Producto
      </Button>

      <Divider />

      <div style={{ textAlign: 'right' }}>
        <Text style={{ fontSize: 16 }}>
          Total:{' '}
          <Text strong style={{ fontSize: 18 }}>
            ${totalAmount.toLocaleString('es-CL', { minimumFractionDigits: 0 })}
          </Text>
        </Text>
      </div>
    </Modal>
  )
}

export default PurchaseForm
