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
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'))
const AuditPage = lazy(() => import('@/pages/Audit/AuditPage'))
const CategoriesPage = lazy(() => import('@/pages/Categories/CategoriesPage'))
const PromotionsPage = lazy(() => import('@/pages/Promotions/PromotionsPage'))
const AlertsPage = lazy(() => import('@/pages/Alerts/AlertsPage'))
const PeriodClosePage = lazy(() => import('@/pages/PeriodClose/PeriodClosePage'))
const SalesPage = lazy(() => import('@/pages/Sales/SalesPage'))
const StoreConfigPage = lazy(() => import('@/pages/StoreConfig/StoreConfigPage'))

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
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/cash" element={<CashPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route
              path="/audit"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute requiredRoles={['ADMIN', 'SUPERVISOR']}>
                  <CategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/period-close" element={<PeriodClosePage />} />
            <Route
              path="/store-config"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <StoreConfigPage />
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
