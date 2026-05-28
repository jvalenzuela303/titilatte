import React from 'react'
import { Typography, Breadcrumb, Space } from 'antd'
import type { BreadcrumbProps } from 'antd'

const { Title, Text } = Typography

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbProps['items']
  extra?: React.ReactNode
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, extra }) => {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && (
        <Breadcrumb items={breadcrumbs} style={{ marginBottom: 8 }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
          {subtitle && (
            <Text type="secondary" style={{ fontSize: 14 }}>
              {subtitle}
            </Text>
          )}
        </Space>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  )
}

export default PageHeader
