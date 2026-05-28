import React, { useState } from 'react'
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Typography,
  theme,
  Grid,
  Drawer,
} from 'antd'
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  InboxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  ShopOutlined,
  ShoppingOutlined,
  WalletOutlined,
  TeamOutlined,
  BarChartOutlined,
  AuditOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import BranchSelector from '@/components/layout/BranchSelector'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = Layout
const { Text } = Typography
const { useBreakpoint } = Grid

const SIDER_WIDTH = 200
const SIDER_COLLAPSED_WIDTH = 80

const baseMenuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/pos',
    icon: <ShoppingCartOutlined />,
    label: 'POS - Ventas',
  },
  {
    key: '/products',
    icon: <AppstoreOutlined />,
    label: 'Productos',
  },
  {
    key: '/stock',
    icon: <InboxOutlined />,
    label: 'Stock',
  },
  {
    key: '/purchases',
    icon: <ShoppingOutlined />,
    label: 'Compras',
  },
  {
    key: '/cash',
    icon: <WalletOutlined />,
    label: 'Caja',
  },
  {
    key: '/customers',
    icon: <TeamOutlined />,
    label: 'Clientes',
  },
  {
    key: '/reports',
    icon: <BarChartOutlined />,
    label: 'Reportes',
  },
]

// Items visible only to ADMIN and SUPERVISOR
const adminSupervisorMenuItems: MenuProps['items'] = [
  {
    key: '/branches',
    icon: <ApartmentOutlined />,
    label: 'Sucursales',
  },
]

const adminMenuItems: MenuProps['items'] = [
  {
    key: '/audit',
    icon: <AuditOutlined />,
    label: 'Auditoria',
  },
]

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CAJERO: 'Cajero',
  BODEGA: 'Bodega',
}

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAdmin, isSupervisor } = useAuth()
  const { token } = theme.useToken()
  const screens = useBreakpoint()

  const isMobile = !screens.md

  const menuItems: MenuProps['items'] = isAdmin
    ? [
        ...(baseMenuItems ?? []),
        ...(adminSupervisorMenuItems ?? []),
        ...(adminMenuItems ?? []),
      ]
    : isSupervisor
      ? [...(baseMenuItems ?? []), ...(adminSupervisorMenuItems ?? [])]
      : baseMenuItems

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    if (isMobile) setDrawerOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Usuario',
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar sesión',
      danger: true,
      onClick: handleLogout,
    },
  ]

  const userRoleLabel = user?.roles?.[0]?.name
    ? (roleLabel[user.roles[0].name] ?? user.roles[0].name)
    : ''

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
          padding: collapsed && !isMobile ? 0 : '0 20px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          gap: 10,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/dashboard')}
      >
        <ShopOutlined style={{ fontSize: 22, color: token.colorPrimary, flexShrink: 0 }} />
        {(!collapsed || isMobile) && (
          <Text
            strong
            style={{
              fontSize: 16,
              color: token.colorPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            Minimarket
          </Text>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        inlineCollapsed={collapsed && !isMobile}
        style={{ borderRight: 0, marginTop: 8 }}
      />
    </>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={SIDER_WIDTH}
          collapsedWidth={SIDER_COLLAPSED_WIDTH}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            background: token.colorBgContainer,
            boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={SIDER_WIDTH}
          styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main layout */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH,
          transition: 'margin-left 0.2s',
        }}
      >
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 99,
            padding: '0 16px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Button
            type="text"
            icon={
              isMobile ? (
                <MenuUnfoldOutlined />
              ) : collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={() => {
              if (isMobile) {
                setDrawerOpen(true)
              } else {
                setCollapsed(!collapsed)
              }
            }}
            style={{ fontSize: 18 }}
            aria-label="Toggle menu"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isMobile && <BranchSelector />}
            {!isMobile && userRoleLabel && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {userRoleLabel}
              </Text>
            )}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <Button type="text" style={{ padding: '4px 8px', height: 'auto' }}>
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  style={{ background: token.colorPrimary, cursor: 'pointer' }}
                />
                {!isMobile && (
                  <Text style={{ marginLeft: 8, fontSize: 14 }}>
                    {user?.firstName ?? 'Usuario'}
                  </Text>
                )}
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            padding: isMobile ? 12 : 24,
            minHeight: 'calc(100vh - 64px)',
            background: token.colorBgLayout,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
