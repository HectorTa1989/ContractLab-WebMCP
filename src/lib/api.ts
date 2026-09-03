import type { SessionUser } from '../types'

const parse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>
  const payload = await response.json().catch(() => ({ error: 'Request failed.' })) as { error?: string }
  throw new Error(payload.error ?? 'Request failed.')
}

export const getSession = async (): Promise<SessionUser> => parse(await fetch('/api/session', { credentials: 'include' }))

export const loginAdmin = async (email: string, password: string): Promise<SessionUser> => parse(await fetch('/api/auth/admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email, password }),
}))

export const logout = async () => {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  if (!response.ok) throw new Error('Could not sign out.')
}

export const createCheckout = async (email: string): Promise<{ url: string }> => parse(await fetch('/api/polar/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email }),
}))

export const verifyCheckout = async (checkoutId: string): Promise<SessionUser> => parse(await fetch(`/api/polar/verify?checkout_id=${encodeURIComponent(checkoutId)}`, { credentials: 'include' }))
