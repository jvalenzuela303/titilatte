import { useState, useEffect } from 'react'
import type { Branch } from '@/services/branchService'
import { branchService } from '@/services/branchService'

// Module-level cache: fetched once per session, shared across all hook instances
let _cache: Branch | null = null
let _promise: Promise<Branch> | null = null

async function fetchConfig(): Promise<Branch> {
  if (_promise) return _promise
  _promise = branchService.getConfig().then((res) => {
    _cache = res.data
    return _cache
  })
  return _promise
}

export function useStoreConfig(): Branch | null {
  const [config, setConfig] = useState<Branch | null>(_cache)

  useEffect(() => {
    if (_cache) return
    fetchConfig()
      .then(setConfig)
      .catch(() => {})
  }, [])

  return config
}
