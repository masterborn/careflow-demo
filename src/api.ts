import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditEvent, CareRequest, RequestType, Role } from '../server/api.ts'

export type { AuditEvent, CareRequest, RequestType, Role }

export interface User {
  id: string
  email: string
  name: string
  role: Role
  title: string
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText)
  return data as T
}

/** Fetch data and refresh it every `intervalMs` so dashboards update live across browsers. */
export function usePolling<T>(path: string, intervalMs = 2000) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const pathRef = useRef(path)
  pathRef.current = path

  const refresh = useCallback(async () => {
    try {
      setData(await api<T>(pathRef.current))
      setError(null)
    } catch (e) {
      setError(e as ApiError)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, intervalMs)
    return () => clearInterval(t)
  }, [path, intervalMs, refresh])

  return { data, error, refresh }
}

export const TYPE_LABEL: Record<RequestType, string> = {
  refill: 'Prescription refill',
  appointment: 'Appointment',
  referral: 'Specialist referral',
}

export function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return '—'
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} s`
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = minutes / 60
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`
}
