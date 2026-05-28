import React, { useEffect, useState } from 'react'
import { Select, Typography } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { branchService } from '@/services/branchService'
import type { Branch } from '@/services/branchService'

const { Text } = Typography

/**
 * Compact branch selector shown in the header exclusively for global ADMINs
 * (users with role ADMIN whose User object has no branchId assigned, i.e., null).
 *
 * Selecting a branch sets `activeBranchId` in the authStore. API callers can
 * read this value to filter requests by branch.
 */
const BranchSelector: React.FC = () => {
  const { user, isAdmin } = useAuth()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const setActiveBranchId = useAuthStore((s) => s.setActiveBranchId)

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)

  // Only show for global ADMIN: role is ADMIN and user has no fixed branchId.
  // The User type does not include branchId, so we check via a type-safe cast.
  const userWithBranch = user as (typeof user & { branchId?: string | null }) | null
  const isGlobalAdmin = isAdmin && !userWithBranch?.branchId

  useEffect(() => {
    if (!isGlobalAdmin) return
    setLoading(true)
    branchService
      .findAll()
      .then((res) => {
        // Only list active branches in the selector
        setBranches(res.data.filter((b) => b.isActive))
      })
      .catch(() => {
        // Silently fail — the selector is a convenience feature
      })
      .finally(() => setLoading(false))
  }, [isGlobalAdmin])

  if (!isGlobalAdmin) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <ApartmentOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        Sucursal:
      </Text>
      <Select
        size="small"
        loading={loading}
        value={activeBranchId ?? undefined}
        placeholder="Todas"
        allowClear
        style={{ minWidth: 140 }}
        onChange={(value: string | undefined) => {
          setActiveBranchId(value ?? null)
        }}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
        aria-label="Seleccionar sucursal activa"
      />
    </div>
  )
}

export default BranchSelector
