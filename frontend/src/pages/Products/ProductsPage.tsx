import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  Row,
  Col,
  Card,
  theme,
  Typography,
  App,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '@/components/common/PageHeader'
import ProductForm from './ProductForm'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/hooks/useAuth'
import type { Product, ProductCategory2, CreateProductRequest } from '@/types'

const { Text } = Typography

const ProductsPage: React.FC = () => {
  const { token } = theme.useToken()
  const { isAdmin } = useAuth()
  const {
    products,
    pagination,
    isLoading,
    fetchProducts,
    createProduct,
    updateProduct,
  } = useProducts()

  const { message } = App.useApp()
  const [searchName, setSearchName] = useState('')
  const [searchBarcode, setSearchBarcode] = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadProducts = useCallback(
    (page = 1) => {
      fetchProducts({
        page,
        size: pagination.pageSize,
        name: searchName || undefined,
        barcode: searchBarcode || undefined,
        active: activeFilter,
      })
    },
    [fetchProducts, pagination.pageSize, searchName, searchBarcode, activeFilter]
  )

  useEffect(() => {
    loadProducts(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => loadProducts(1)

  const handleReset = () => {
    setSearchName('')
    setSearchBarcode('')
    setActiveFilter(true)
    fetchProducts({ page: 1, size: pagination.pageSize, active: true })
  }

  const handleFormSubmit = async (data: CreateProductRequest) => {
    setIsSubmitting(true)
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data)
      } else {
        await createProduct(data)
      }
      setFormOpen(false)
      setEditingProduct(null)
      loadProducts(pagination.current)
    } catch {
      message.error('Error al guardar el producto')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async (product: Product) => {
    setIsSubmitting(true)
    try {
      await updateProduct(product.id, { active: false })
      message.success(`"${product.name}" desactivado`)
      loadProducts(pagination.current)
    } catch {
      message.error('Error al desactivar el producto')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnsType<Product> = [
    {
      title: 'Código Barra',
      dataIndex: 'barcode',
      key: 'barcode',
      width: 140,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (v: ProductCategory2) => (
        <Tag color="blue" style={{ fontSize: 11 }}>
          {v?.name ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Precio Venta',
      dataIndex: 'salePrice',
      key: 'salePrice',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: token.colorPrimary }}>
          ${Math.round(v).toLocaleString('es-CL')}
        </Text>
      ),
    },
    {
      title: 'Stock',
      dataIndex: 'stockCurrent',
      key: 'stockCurrent',
      width: 90,
      align: 'center',
      render: (v: number, record: Product) => {
        const isLow = v <= record.stockMinimum
        const isCritical = v === 0
        return (
          <Text
            strong
            style={{
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
      title: 'Estado',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      align: 'center',
      render: (v: boolean) =>
        v ? (
          <Tag color="green">Activo</Tag>
        ) : (
          <Tag color="red">Inactivo</Tag>
        ),
    },
    ...(isAdmin
      ? [
          {
            title: 'Acciones',
            key: 'actions',
            width: 120,
            fixed: 'right' as const,
            render: (_: unknown, record: Product) => (
              <Space size="small">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingProduct(record)
                    setFormOpen(true)
                  }}
                />
                {record.active && (
                  <Popconfirm
                    title="Desactivar producto"
                    description={`¿Desactivar "${record.name}"? No aparecerá en el POS.`}
                    onConfirm={() => handleDeactivate(record)}
                    okText="Desactivar"
                    cancelText="Cancelar"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<StopOutlined />}
                    />
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
        title="Productos"
        subtitle="Gestiona el catálogo de productos del minimarket"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Productos' }]}
        extra={
          isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingProduct(null)
                setFormOpen(true)
              }}
            >
              Nuevo Producto
            </Button>
          )
        }
      />

      {/* Filters */}
      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
          marginBottom: 16,
        }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={7}>
            <Input
              placeholder="Buscar por nombre"
              prefix={<SearchOutlined />}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} md={7}>
            <Input
              placeholder="Buscar por código de barras"
              prefix={<SearchOutlined />}
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              value={activeFilter}
              onChange={(val) => setActiveFilter(val)}
              placeholder="Estado"
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: true, label: 'Activos' },
                { value: false, label: 'Inactivos' },
              ]}
            />
          </Col>
          <Col xs={24} sm={24} md={6}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                Buscar
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                Limpiar
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

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
          dataSource={products}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${total} productos`,
            onChange: (page, pageSize) => {
              fetchProducts({
                page,
                size: pageSize,
                name: searchName || undefined,
                barcode: searchBarcode || undefined,
                active: activeFilter,
              })
            },
          }}
        />
      </Card>

      <ProductForm
        open={formOpen}
        product={editingProduct}
        onClose={() => {
          setFormOpen(false)
          setEditingProduct(null)
        }}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

export default ProductsPage
