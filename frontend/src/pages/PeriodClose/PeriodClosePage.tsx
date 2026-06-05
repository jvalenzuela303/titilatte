import React, { useState, useEffect, useCallback } from 'react'
import {
  Tabs,
  Table,
  Button,
  Select,
  Descriptions,
  Drawer,
  Statistic,
  Row,
  Col,
  Card,
  Tag,
  Typography,
  Modal,
  Input,
  Space,
  Spin,
  Alert,
  App,
  theme,
} from 'antd'
import {
  DownloadOutlined,
  LockOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import PageHeader from '@/components/common/PageHeader'
import periodCloseService from '@/services/periodCloseService'
import { useAuth } from '@/hooks/useAuth'
import type { PeriodClose, MonthlyComparison } from '@/types'

const { Text, Title } = Typography

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const currentYear = dayjs().year()
const currentMonth = dayjs().month() + 1

const PeriodClosePage: React.FC = () => {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const { isAdmin } = useAuth()

  const [periods, setPeriods] = useState<PeriodClose[]>([])
  const [periodTotal, setPeriodTotal] = useState(0)
  const [periodPage, setPeriodPage] = useState(1)
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false)

  const [previewYear, setPreviewYear] = useState(currentYear)
  const [previewMonth, setPreviewMonth] = useState(currentMonth)
  const [previewData, setPreviewData] = useState<PeriodClose | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const [isClosing, setIsClosing] = useState(false)
  const [closeNotes, setCloseNotes] = useState('')
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  const [comparison, setComparison] = useState<MonthlyComparison[]>([])
  const [isLoadingComparison, setIsLoadingComparison] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodClose | null>(null)

  const [activeTab, setActiveTab] = useState('list')

  const loadPeriods = useCallback(async (page = 1) => {
    setIsLoadingPeriods(true)
    try {
      const res = await periodCloseService.getAll(page - 1, 20)
      setPeriods(res.data.content)
      setPeriodTotal(res.data.totalElements)
      setPeriodPage(page)
    } catch {
      message.error('Error al cargar los períodos')
    } finally {
      setIsLoadingPeriods(false)
    }
  }, [])

  const loadComparison = useCallback(async () => {
    setIsLoadingComparison(true)
    try {
      const res = await periodCloseService.getComparison(12)
      setComparison(res.data)
    } catch {
      message.error('Error al cargar la comparación mensual')
    } finally {
      setIsLoadingComparison(false)
    }
  }, [])

  useEffect(() => {
    loadPeriods(1)
  }, [loadPeriods])

  useEffect(() => {
    if (activeTab === 'comparison') {
      loadComparison()
    }
  }, [activeTab, loadComparison])

  const handlePreview = async () => {
    setIsLoadingPreview(true)
    setIsPreviewing(true)
    setPreviewData(null)
    try {
      const res = await periodCloseService.preview(previewYear, previewMonth)
      setPreviewData(res.data)
    } catch {
      message.error('Error al generar la vista previa del período')
      setIsPreviewing(false)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleClose = async () => {
    setIsClosing(true)
    try {
      await periodCloseService.close({
        year: previewYear,
        month: previewMonth,
        notes: closeNotes || undefined,
      })
      message.success(`Período ${MONTHS[previewMonth - 1]} ${previewYear} cerrado exitosamente`)
      setCloseConfirmOpen(false)
      setPreviewData(null)
      setIsPreviewing(false)
      setCloseNotes('')
      loadPeriods(1)
      setActiveTab('list')
    } catch {
      message.error('Error al cerrar el período')
    } finally {
      setIsClosing(false)
    }
  }

  const handleExportExcel = async (id: string) => {
    try {
      const res = await periodCloseService.exportExcel(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `periodo-${id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Error al exportar el archivo Excel')
    }
  }

  const handleOpenDrawer = (period: PeriodClose) => {
    setSelectedPeriod(period)
    setDrawerOpen(true)
  }

  const periodsColumns: ColumnsType<PeriodClose> = [
    {
      title: 'Período',
      key: 'period',
      width: 140,
      render: (_: unknown, record: PeriodClose) => (
        <Text strong>
          {MONTHS[record.periodMonth - 1]} {record.periodYear}
        </Text>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: PeriodClose['status']) =>
        v === 'CLOSED' ? (
          <Tag color="green">Cerrado</Tag>
        ) : (
          <Tag color="blue">Borrador</Tag>
        ),
    },
    {
      title: 'Ingresos',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 130,
      align: 'right',
      render: (v: number) => <Text>${v.toLocaleString()}</Text>,
    },
    {
      title: 'Ganancia',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      width: 130,
      align: 'right',
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? token.colorSuccess : token.colorError }}>
          ${v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Margen',
      dataIndex: 'profitMarginPct',
      key: 'profitMarginPct',
      width: 90,
      align: 'center',
      render: (v: number) => <Text>{v.toFixed(1)}%</Text>,
    },
    {
      title: 'Ventas',
      dataIndex: 'saleCount',
      key: 'saleCount',
      width: 80,
      align: 'center',
    },
    {
      title: 'Cerrado',
      dataIndex: 'closedAt',
      key: 'closedAt',
      width: 150,
      render: (v: string | null) =>
        v ? (
          <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: PeriodClose) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDrawer(record)}
          />
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExportExcel(record.id)}
          />
        </Space>
      ),
    },
  ]

  const comparisonColumns: ColumnsType<MonthlyComparison> = [
    {
      title: 'Período',
      key: 'period',
      width: 140,
      render: (_: unknown, record: MonthlyComparison, index: number) => {
        const prev = comparison[index + 1]
        const trend =
          prev !== undefined ? (
            record.totalRevenue > prev.totalRevenue ? (
              <ArrowUpOutlined style={{ color: token.colorSuccess, marginLeft: 4 }} />
            ) : (
              <ArrowDownOutlined style={{ color: token.colorError, marginLeft: 4 }} />
            )
          ) : null
        return (
          <Text strong>
            {MONTHS[record.month - 1]} {record.year}
            {trend}
          </Text>
        )
      },
    },
    {
      title: 'Ingresos',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      align: 'right',
      render: (v: number) => <Text>${v.toLocaleString()}</Text>,
    },
    {
      title: 'Ganancia',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      align: 'right',
      render: (v: number) => (
        <Text style={{ color: v >= 0 ? token.colorSuccess : token.colorError }}>
          ${v.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Margen %',
      dataIndex: 'profitMarginPct',
      key: 'profitMarginPct',
      width: 90,
      align: 'center',
      render: (v: number) => <Text>{v.toFixed(1)}%</Text>,
    },
    {
      title: 'Ventas',
      dataIndex: 'saleCount',
      key: 'saleCount',
      width: 80,
      align: 'center',
    },
    {
      title: 'Estado',
      dataIndex: 'isClosed',
      key: 'isClosed',
      width: 110,
      render: (v: boolean) =>
        v ? <Tag color="green">Cerrado</Tag> : <Tag color="blue">Borrador</Tag>,
    },
  ]

  const yearOptions = [2024, 2025, 2026, 2027].map((y) => ({ value: y, label: String(y) }))
  const monthOptions = MONTHS.map((m, i) => ({ value: i + 1, label: m }))

  return (
    <div>
      <PageHeader
        title="Cierre de Período"
        subtitle="Gestiona los cierres mensuales y compara el rendimiento financiero"
        breadcrumbs={[{ title: 'Inicio' }, { title: 'Cierre Período' }]}
      />

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
              key: 'list',
              label: 'Períodos cerrados',
              children: (
                <Table
                  columns={periodsColumns}
                  dataSource={periods}
                  rowKey="id"
                  loading={isLoadingPeriods}
                  scroll={{ x: 900 }}
                  onRow={(record) => ({
                    onClick: () => handleOpenDrawer(record),
                    style: { cursor: 'pointer' },
                  })}
                  pagination={{
                    current: periodPage,
                    pageSize: 20,
                    total: periodTotal,
                    onChange: (page) => loadPeriods(page),
                    showTotal: (t) => `${t} períodos`,
                  }}
                />
              ),
            },
            {
              key: 'new',
              label: 'Nuevo cierre',
              children: isAdmin ? (
                <div>
                  <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
                    <Col>
                      <Text strong style={{ marginRight: 8 }}>
                        Año:
                      </Text>
                      <Select
                        value={previewYear}
                        onChange={setPreviewYear}
                        options={yearOptions}
                        style={{ width: 100 }}
                      />
                    </Col>
                    <Col>
                      <Text strong style={{ marginRight: 8 }}>
                        Mes:
                      </Text>
                      <Select
                        value={previewMonth}
                        onChange={setPreviewMonth}
                        options={monthOptions}
                        style={{ width: 140 }}
                      />
                    </Col>
                    <Col>
                      <Button
                        type="default"
                        icon={<EyeOutlined />}
                        onClick={handlePreview}
                        loading={isLoadingPreview}
                      >
                        Vista previa
                      </Button>
                    </Col>
                  </Row>

                  {isLoadingPreview && (
                    <div style={{ textAlign: 'center', padding: 48 }}>
                      <Spin size="large" />
                    </div>
                  )}

                  {isPreviewing && previewData && !isLoadingPreview && (
                    <div>
                      <Card
                        title={
                          <Title level={5} style={{ margin: 0 }}>
                            Vista previa del período {MONTHS[previewMonth - 1]} {previewYear}
                          </Title>
                        }
                        style={{
                          marginBottom: 16,
                          borderRadius: token.borderRadiusLG,
                          boxShadow: token.boxShadowTertiary,
                        }}
                      >
                        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Ingresos"
                              value={previewData.totalRevenue}
                              prefix="$"
                              precision={0}
                              valueStyle={{ color: token.colorPrimary }}
                            />
                          </Col>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Costos"
                              value={previewData.totalCost}
                              prefix="$"
                              precision={0}
                              valueStyle={{ color: token.colorWarning }}
                            />
                          </Col>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Ganancia"
                              value={previewData.totalProfit}
                              prefix="$"
                              precision={0}
                              valueStyle={{
                                color:
                                  previewData.totalProfit >= 0
                                    ? token.colorSuccess
                                    : token.colorError,
                              }}
                            />
                          </Col>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Margen %"
                              value={previewData.profitMarginPct}
                              suffix="%"
                              precision={1}
                              valueStyle={{ color: token.colorInfo }}
                            />
                          </Col>
                        </Row>

                        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="N° Ventas"
                              value={previewData.saleCount}
                            />
                          </Col>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Crédito"
                              value={previewData.totalCreditSales}
                              prefix="$"
                              precision={0}
                            />
                          </Col>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Cobros"
                              value={previewData.totalPaymentsReceived}
                              prefix="$"
                              precision={0}
                              valueStyle={{ color: token.colorSuccess }}
                            />
                          </Col>
                          <Col xs={12} sm={6}>
                            <Statistic
                              title="Por cobrar"
                              value={previewData.outstandingReceivables}
                              prefix="$"
                              precision={0}
                              valueStyle={{ color: token.colorWarning }}
                            />
                          </Col>
                        </Row>

                        {previewData.revenueChangePct !== null && (
                          <Alert
                            type={previewData.revenueChangePct >= 0 ? 'success' : 'warning'}
                            message={
                              <Space>
                                {previewData.revenueChangePct >= 0 ? (
                                  <ArrowUpOutlined />
                                ) : (
                                  <ArrowDownOutlined />
                                )}
                                <Text>
                                  Variación vs período anterior:{' '}
                                  <Text strong>
                                    {previewData.revenueChangePct >= 0 ? '+' : ''}
                                    {previewData.revenueChangePct.toFixed(1)}%
                                  </Text>{' '}
                                  en ingresos
                                </Text>
                              </Space>
                            }
                            style={{ marginBottom: 0 }}
                          />
                        )}
                      </Card>

                      <div style={{ marginBottom: 16 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>
                          Notas del cierre (opcional)
                        </Text>
                        <Input.TextArea
                          rows={3}
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          placeholder="Observaciones o notas para este cierre de período..."
                        />
                      </div>

                      {previewData.status === 'CLOSED' ? (
                        <Alert
                          type="warning"
                          message="Este período ya fue cerrado y no puede cerrarse nuevamente."
                          showIcon
                        />
                      ) : (
                        <Button
                          type="primary"
                          danger
                          icon={<LockOutlined />}
                          onClick={() => setCloseConfirmOpen(true)}
                          size="large"
                        >
                          Cerrar período
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Alert
                  type="warning"
                  message="Solo los administradores pueden realizar cierres de período."
                  showIcon
                />
              ),
            },
            {
              key: 'comparison',
              label: 'Comparación mensual',
              children: (
                <Spin spinning={isLoadingComparison}>
                  <Table
                    columns={comparisonColumns}
                    dataSource={comparison}
                    rowKey={(r) => `${r.year}-${r.month}`}
                    scroll={{ x: 700 }}
                    pagination={false}
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={
          selectedPeriod
            ? `${MONTHS[selectedPeriod.periodMonth - 1]} ${selectedPeriod.periodYear}`
            : 'Detalle del período'
        }
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedPeriod(null)
        }}
        width={600}
        extra={
          selectedPeriod && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleExportExcel(selectedPeriod.id)}
            >
              Exportar Excel
            </Button>
          )
        }
      >
        {selectedPeriod && (
          <div>
            <div style={{ marginBottom: 16 }}>
              {selectedPeriod.status === 'CLOSED' ? (
                <Tag color="green">Cerrado</Tag>
              ) : (
                <Tag color="blue">Borrador</Tag>
              )}
              {selectedPeriod.closedAt && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  Cerrado el {dayjs(selectedPeriod.closedAt).format('DD/MM/YYYY HH:mm')}
                  {selectedPeriod.closedByEmail && ` por ${selectedPeriod.closedByEmail}`}
                </Text>
              )}
            </div>

            <Title level={5} style={{ marginBottom: 8 }}>
              Ventas
            </Title>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Ingresos totales">
                ${selectedPeriod.totalRevenue.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="N° de ventas">
                {selectedPeriod.saleCount}
              </Descriptions.Item>
              <Descriptions.Item label="Ventas a crédito">
                ${selectedPeriod.totalCreditSales.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Descuentos otorgados">
                ${selectedPeriod.totalDiscountGiven.toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 8 }}>
              Costos y Márgenes
            </Title>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Costo total">
                ${selectedPeriod.totalCost.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Ganancia">
                <Text
                  style={{
                    color:
                      selectedPeriod.totalProfit >= 0
                        ? token.colorSuccess
                        : token.colorError,
                  }}
                >
                  ${selectedPeriod.totalProfit.toLocaleString()}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Margen de ganancia" span={2}>
                {selectedPeriod.profitMarginPct.toFixed(2)}%
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 8 }}>
              Cobros y Crédito
            </Title>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Cobros recibidos">
                ${selectedPeriod.totalPaymentsReceived.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Por cobrar">
                <Text style={{ color: token.colorWarning }}>
                  ${selectedPeriod.outstandingReceivables.toLocaleString()}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 8 }}>
              Caja y Compras
            </Title>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Aperturas de caja">
                {selectedPeriod.totalCashOpenings}
              </Descriptions.Item>
              <Descriptions.Item label="Total compras">
                ${selectedPeriod.totalPurchaseAmount.toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            {selectedPeriod.revenueChangePct !== null && (
              <Alert
                type={selectedPeriod.revenueChangePct >= 0 ? 'success' : 'warning'}
                message={
                  <Space>
                    {selectedPeriod.revenueChangePct >= 0 ? (
                      <ArrowUpOutlined />
                    ) : (
                      <ArrowDownOutlined />
                    )}
                    <Text>
                      Vs. período anterior:{' '}
                      <Text strong>
                        {selectedPeriod.revenueChangePct >= 0 ? '+' : ''}
                        {selectedPeriod.revenueChangePct.toFixed(1)}%
                      </Text>{' '}
                      en ingresos
                    </Text>
                  </Space>
                }
              />
            )}

            {selectedPeriod.notes && (
              <div style={{ marginTop: 16 }}>
                <Text strong>Notas:</Text>
                <br />
                <Text type="secondary">{selectedPeriod.notes}</Text>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Close Confirmation Modal */}
      <Modal
        title="Confirmar cierre de período"
        open={closeConfirmOpen}
        onCancel={() => setCloseConfirmOpen(false)}
        onOk={handleClose}
        okText="Confirmar cierre"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
        confirmLoading={isClosing}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Esta acción es irreversible"
          description={`Una vez cerrado el período ${MONTHS[previewMonth - 1]} ${previewYear}, no podrá modificarse. ¿Confirmar cierre?`}
        />
      </Modal>
    </div>
  )
}

export default PeriodClosePage
