import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Divider,
  Typography,
  App,
} from 'antd'
import apiClient from '@/config/axios'
import type { Product, ProductCategory } from '@/types'

const { Text } = Typography

interface TaxOption {
  id: string
  name: string
  rate: number
}

const productSchema = z
  .object({
    barcode: z.string().min(1, 'El código de barras es requerido').max(50),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
    description: z.string().max(500).optional(),
    purchasePrice: z
      .number({ required_error: 'El precio de compra es requerido' })
      .positive('Debe ser mayor a 0'),
    salePrice: z
      .number({ required_error: 'El precio de venta es requerido' })
      .positive('Debe ser mayor a 0'),
    stockMinimum: z
      .number({ required_error: 'El stock mínimo es requerido' })
      .int('Debe ser entero')
      .min(0, 'No puede ser negativo'),
    stockMaximum: z
      .number({ required_error: 'El stock máximo es requerido' })
      .int('Debe ser entero')
      .positive('Debe ser mayor a 0'),
    categoryId: z.string().min(1, 'Selecciona una categoría'),
    taxId: z.string().min(1, 'Selecciona un impuesto'),
  })
  .refine((d) => d.salePrice >= d.purchasePrice, {
    message: 'El precio de venta debe ser mayor o igual al precio de compra',
    path: ['salePrice'],
  })
  .refine((d) => d.stockMaximum > d.stockMinimum, {
    message: 'El stock máximo debe ser mayor al stock mínimo',
    path: ['stockMaximum'],
  })

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
  open: boolean
  product: Product | null
  onClose: () => void
  onSubmit: (data: ProductFormValues) => Promise<void>
  isSubmitting: boolean
}

const ProductForm: React.FC<ProductFormProps> = ({
  open,
  product,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const { message } = App.useApp()
  const isEditing = product !== null
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [taxes, setTaxes] = useState<TaxOption[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      barcode: '',
      name: '',
      description: '',
      purchasePrice: 0,
      salePrice: 0,
      stockMinimum: 5,
      stockMaximum: 100,
      categoryId: '',
      taxId: '',
    },
  })

  // Load categories and taxes when modal opens
  useEffect(() => {
    if (!open) return

    const loadMeta = async () => {
      setLoadingMeta(true)
      try {
        const [catRes, taxRes] = await Promise.all([
          apiClient.get<ProductCategory[]>('/categories'),
          apiClient.get<TaxOption[]>('/taxes'),
        ])
        setCategories(catRes.data)
        setTaxes(taxRes.data)
      } catch {
        message.error('No se pudieron cargar categorías e impuestos')
      } finally {
        setLoadingMeta(false)
      }
    }

    loadMeta()
  }, [open])

  // Populate form when editing an existing product
  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          barcode: product.barcode,
          name: product.name,
          description: product.description ?? '',
          purchasePrice: product.purchasePrice,
          salePrice: product.salePrice,
          stockMinimum: product.stockMinimum,
          stockMaximum: product.stockMaximum,
          categoryId: product.category.id,
          taxId: product.tax.id,
        })
      } else {
        reset({
          barcode: '',
          name: '',
          description: '',
          purchasePrice: 0,
          salePrice: 0,
          stockMinimum: 5,
          stockMaximum: 100,
          categoryId: '',
          taxId: '',
        })
      }
    }
  }, [open, product, reset])

  const validateStatus = (field: keyof ProductFormValues) =>
    errors[field] ? 'error' : ('' as const)

  return (
    <Modal
      title={isEditing ? 'Editar Producto' : 'Nuevo Producto'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      okText={isEditing ? 'Guardar cambios' : 'Crear producto'}
      cancelText="Cancelar"
      confirmLoading={isSubmitting}
      width={660}
      destroyOnHidden
    >
      <Form layout="vertical" style={{ marginTop: 8 }}>
        <Divider orientation="left" plain>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Identificación
          </Text>
        </Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Código de barras"
              validateStatus={validateStatus('barcode')}
              help={errors.barcode?.message}
              required
            >
              <Controller
                name="barcode"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="7501055300959" autoFocus />
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Categoría"
              validateStatus={validateStatus('categoryId')}
              help={errors.categoryId?.message}
              required
            >
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    loading={loadingMeta}
                    placeholder="Seleccionar categoría"
                    options={categories.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    showSearch
                    optionFilterProp="label"
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Nombre del producto"
          validateStatus={validateStatus('name')}
          help={errors.name?.message}
          required
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="Ej: Leche entera 1L" />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Descripción"
          validateStatus={validateStatus('description')}
          help={errors.description?.message}
        >
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                rows={2}
                placeholder="Descripción opcional del producto"
              />
            )}
          />
        </Form.Item>

        <Divider orientation="left" plain>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Precios e impuestos
          </Text>
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="Precio compra (S/.)"
              validateStatus={validateStatus('purchasePrice')}
              help={errors.purchasePrice?.message}
              required
            >
              <Controller
                name="purchasePrice"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    min={0}
                    step={0.1}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="0.00"
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Precio venta (S/.)"
              validateStatus={validateStatus('salePrice')}
              help={errors.salePrice?.message}
              required
            >
              <Controller
                name="salePrice"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    min={0}
                    step={0.1}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="0.00"
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Impuesto"
              validateStatus={validateStatus('taxId')}
              help={errors.taxId?.message}
              required
            >
              <Controller
                name="taxId"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    loading={loadingMeta}
                    placeholder="Seleccionar"
                    options={taxes.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.rate}%)`,
                    }))}
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Control de stock
          </Text>
        </Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Stock mínimo"
              validateStatus={validateStatus('stockMinimum')}
              help={errors.stockMinimum?.message}
              required
            >
              <Controller
                name="stockMinimum"
                control={control}
                render={({ field }) => (
                  <InputNumber {...field} min={0} style={{ width: '100%' }} placeholder="5" />
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Stock máximo"
              validateStatus={validateStatus('stockMaximum')}
              help={errors.stockMaximum?.message}
              required
            >
              <Controller
                name="stockMaximum"
                control={control}
                render={({ field }) => (
                  <InputNumber {...field} min={1} style={{ width: '100%' }} placeholder="100" />
                )}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

export default ProductForm
