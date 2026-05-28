import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin, theme, ConfigProvider } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

dayjs.locale('es')

// Lazy-loaded page components for code splitting
const LoginPage = lazy(() => import('@/pages/Login/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'))
const POSPage = lazy(() => import('@/pages/POS/POSPage'))
const ProductsPage = lazy(() => import('@/pages/Products/ProductsPage'))
const StockPage = lazy(() => import('@/pages/Stock/StockPage'))
const PurchasesPage = lazy(() => import('@/pages/Purchases/PurchasesPage'))
const CashPage = lazy(() => import('@/pages/Cash/CashPage'))
const CustomersPage = lazy(() => import('@/pages/Customers/CustomersPage'))
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'))
const AuditPage = lazy(() => import('@/pages/Audit/AuditPage'))
const BranchesPage = lazy(() => import('@/pages/Branches/BranchesPage'))

const PageFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
    }}
  >
    <Spin size="large" />
  </div>
)

// Custom Ant Design theme aligned with Minimarket branding
const minimarketTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#13c2c2',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
    },
    Menu: {
      itemBorderRadius: 6,
    },
    Card: {
      borderRadius: 12,
    },
    Button: {
      borderRadius: 6,
    },
    Input: {
      borderRadius: 6,
    },
    Select: {
      borderRadius: 6,
    },
  },
}

export default function App() {
  return (
    <ConfigProvider theme={minimarketTheme}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected layout wrapper */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/cash" element={<CashPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/audit"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AuditPage />
                </ProtectedRoute>
              }
            />
            {/* Fase 4 routes */}
            <Route
              path="/branches"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'SUPERVISOR']}>
                  <BranchesPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ConfigProvider>
  )
}
