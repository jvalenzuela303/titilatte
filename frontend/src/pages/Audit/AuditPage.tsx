import { useState, useCallback, useEffect } from 'react'
import {
  Table,
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  Tag,
  Modal,
  Descriptions,
  Typography,
  Space,
  Tooltip,
  App,
} from 'antd'
import {
  DownloadOutlined,
  EyeOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import type { RangePickerProps } from 'antd/es/date-picker'
import dayjs, { Dayjs } from 'dayjs'
import { auditService } from '../../services/auditService'
import type { AuditLog } from '../../types'

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// ─── Action tag color map ─────────────────────────────────────────────────────

type TagPreset = 'orange' | 'red' | 'blue' | 'green' | 'default'

function getActionColor(action: string): TagPreset {
  const map: Record<string, TagPreset> = {
    PRICE_CHANGE: 'orange',
    CANCEL: 'red',
    LOGIN_FAILED: 'red',
    DELETE: 'red',
    ADJUSTMENT: 'blue',
    CREATE: 'green',
    UPDATE: 'green',
  }
  // Also match prefix patterns
  if (action.startsWith('CREATE')) return 'green'
  if (action.startsWith('UPDATE')) return 'green'
  if (action.startsWith('DELETE')) return 'red'
  return map[action] ?? 'default'
}

// ─── Known entity types & actions for filter selects ─────────────────────────

const ENTITY_TYPES = [
  'PRODUCT',
  'SALE',
  'PURCHASE',
  'CUSTOMER',
  'CASH_REGISTER',
  'USER',
  'STOCK',
]

const ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'CANCEL',
  'PRICE_CHANGE',
  'ADJUSTMENT',
  'LOGIN_FAILED',
]

// ─── Formatted JSON helper ────────────────────────────────────────────────────

function tryFormatJson(raw: string | null): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2)
  } catch {
    return raw
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Filters {
  entityType?: string
  action?: string
  dateFrom?: string
  dateTo?: string
}

export default function AuditPage() {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<Filters>({})
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchLogs = useCallback(
    async (currentPage: number, size: number, currentFilters: Filters) => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = {
          page: currentPage,
          size,
          ...currentFilters,
        }
        // Remove undefined/empty keys
        Object.keys(params).forEach((k) => {
          if (params[k] === undefined || params[k] === '') {
            delete params[k]
          }
        })
        const res = await auditService.getLogs(params)
        setLogs(res.data.content)
        setTotal(res.data.totalElements)
      } catch {
        void message.error('Error cargando logs de auditoria')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Initial load
  useEffect(() => {
    void fetchLogs(0, pageSize, {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _tableFilters: Record<string, FilterValue | null>,
    _sorter: SorterResult<AuditLog> | SorterResult<AuditLog>[]
  ) => {
    const newPage = (pagination.current ?? 1) - 1
    const newSize = pagination.pageSize ?? pageSize
    setPage(newPage)
    setPageSize(newSize)
    void fetchLogs(newPage, newSize, filters)
  }

  const handleSearch = () => {
    setPage(0)
    void fetchLogs(0, pageSize, filters)
  }

  const handleReset = () => {
    const empty: Filters = {}
    setFilters(empty)
    setPage(0)
    void fetchLogs(0, pageSize, empty)
  }

  const handleDateChange: RangePickerProps['onChange'] = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setFilters((f) => ({
        ...f,
        dateFrom: dates[0]!.startOf('day').toISOString(),
        dateTo: dates[1]!.endOf('day').toISOString(),
      }))
    } else {
      setFilters((f) => {
        const { dateFrom: _df, dateTo: _dt, ...rest } = f
        return rest
      })
    }
  }

  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      const params: Record<string, unknown> = { ...filters }
      Object.keys(params).forEach((k) => {
        if (params[k] === undefined || params[k] === '') delete params[k]
      })
      const res = await auditService.exportExcel(params)
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      void message.error('Error exportando el archivo Excel')
    } finally {
      setExportLoading(false)
    }
  }

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'Entidad',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Accion',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (v: string) => <Tag color={getActionColor(v)}>{v}</Tag>,
    },
    {
      title: 'Usuario',
      dataIndex: 'performedByEmail',
      key: 'performedByEmail',
      ellipsis: true,
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Motivo',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <Text style={{ maxWidth: 160, display: 'inline-block' }} ellipsis>
              {v}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: AuditLog) => (
        <Tooltip title="Ver detalle">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            aria-label="Ver detalle del registro"
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <AuditOutlined style={{ marginRight: 8 }} />
          Auditoria del Sistema
        </Title>
        <Text type="secondary">Historial de acciones realizadas por los usuarios</Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Tipo de entidad"
              allowClear
              style={{ width: '100%' }}
              value={filters.entityType}
              onChange={(v: string | undefined) =>
                setFilters((f) => ({ ...f, entityType: v }))
              }
            >
              {ENTITY_TYPES.map((et) => (
                <Option key={et} value={et}>
                  {et}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Accion"
              allowClear
              style={{ width: '100%' }}
              value={filters.action}
              onChange={(v: string | undefined) =>
                setFilters((f) => ({ ...f, action: v }))
              }
            >
              {ACTIONS.map((ac) => (
                <Option key={ac} value={ac}>
                  <Tag color={getActionColor(ac)} style={{ marginRight: 4 }}>
                    {ac}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={24} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={handleDateChange}
              format="DD/MM/YYYY"
              placeholder={['Fecha desde', 'Fecha hasta']}
            />
          </Col>

          <Col xs={24} sm={24} md={4}>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                Buscar
              </Button>
              <Button onClick={handleReset}>Limpiar</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card
        extra={
          <Button
            icon={<DownloadOutlined />}
            loading={exportLoading}
            onClick={() => void handleExportExcel()}
          >
            Exportar Excel
          </Button>
        }
      >
        <Table<AuditLog>
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: page + 1,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t) => `${t} registros en total`,
          }}
          onChange={handleTableChange}
          locale={{ emptyText: 'No hay registros de auditoria' }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <AuditOutlined />
            <span>Detalle del Registro</span>
            {selectedLog && (
              <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag>
            )}
          </Space>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        }
        width={720}
      >
        {selectedLog && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">
              <Text copyable>{selectedLog.id}</Text>
            </Descriptions.Item>

            <Descriptions.Item label="Fecha">
              {dayjs(selectedLog.createdAt).format('DD/MM/YYYY HH:mm:ss')}
            </Descriptions.Item>

            <Descriptions.Item label="Entidad">
              <Tag>{selectedLog.entityType}</Tag>
              {selectedLog.entityId && (
                <Text type="secondary" copyable style={{ marginLeft: 8 }}>
                  #{selectedLog.entityId}
                </Text>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="Accion">
              <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Usuario">
              {selectedLog.performedByEmail}
            </Descriptions.Item>

            <Descriptions.Item label="IP">
              {selectedLog.ipAddress ?? '—'}
            </Descriptions.Item>

            <Descriptions.Item label="Motivo">
              {selectedLog.reason ?? '—'}
            </Descriptions.Item>

            <Descriptions.Item label="Valor Anterior">
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  background: '#fafafa',
                  padding: '8px 12px',
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {tryFormatJson(selectedLog.oldValue)}
              </pre>
            </Descriptions.Item>

            <Descriptions.Item label="Valor Nuevo">
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  background: '#f6ffed',
                  padding: '8px 12px',
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {tryFormatJson(selectedLog.newValue)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
