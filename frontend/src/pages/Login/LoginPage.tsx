import React, { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Card,
  Form,
  Input,
  Button,
  Alert,
  Typography,
  Space,
  theme,
} from 'antd'
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'

const { Title, Text } = Typography

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Ingresa un email válido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LocationState {
  from?: { pathname: string }
}

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading, error, clearAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const state = location.state as LocationState | null
  const from = state?.from?.pathname ?? '/dashboard'

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'admin@minimarket.local', password: 'Admin1234!' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch {
      // Error is already held in auth store state
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${token.colorPrimary}18 0%, ${token.colorBgLayout} 100%)`,
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: token.boxShadowTertiary,
          borderRadius: token.borderRadiusLG,
        }}
        variant="borderless"
      >
        <Space
          direction="vertical"
          size="large"
          style={{ width: '100%', textAlign: 'center' }}
        >
          {/* Logo */}
          <Space direction="vertical" size={4}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: token.colorPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <ShopOutlined style={{ fontSize: 28, color: '#fff' }} />
            </div>
            <Title level={3} style={{ margin: 0 }}>
              Minimarket
            </Title>
            <Text type="secondary">Sistema de punto de venta</Text>
          </Space>

          {/* Server error alert */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => clearAuth()}
              style={{ textAlign: 'left' }}
            />
          )}

          {/* Login form */}
          <Form
            layout="vertical"
            onFinish={handleSubmit(onSubmit)}
            style={{ textAlign: 'left', marginTop: 8 }}
            autoComplete="on"
          >
            <Form.Item
              label="Correo electrónico"
              validateStatus={errors.email ? 'error' : ''}
              help={errors.email?.message}
            >
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />}
                    placeholder="usuario@minimarket.com"
                    size="large"
                    autoComplete="email"
                    autoFocus
                    disabled={isLoading}
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              validateStatus={errors.password ? 'error' : ''}
              help={errors.password?.message}
            >
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
                    placeholder="••••••••"
                    size="large"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                )}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={isLoading}
              >
                Iniciar Sesión
              </Button>
            </Form.Item>

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16, textAlign: 'left' }}
              message="Credenciales de demo"
              description={
                <span style={{ fontSize: 12 }}>
                  <b>Email:</b> admin@minimarket.local
                  <br />
                  <b>Contraseña:</b> Admin1234!
                </span>
              }
            />
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default LoginPage
