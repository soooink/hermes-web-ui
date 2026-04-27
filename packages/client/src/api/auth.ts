import { request } from './client'

export interface AuthStatus {
  hasPasswordLogin: boolean
  username: string | null
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status')
  if (!res.ok) throw new Error('Failed to fetch auth status')
  return res.json()
}

export async function loginWithPassword(username: string, password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Login failed')
  }
  const data = await res.json()
  return data.token
}

export async function setupPassword(username: string, password: string): Promise<void> {
  return request('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function changeUsername(currentPassword: string, newUsername: string): Promise<void> {
  return request('/api/auth/change-username', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newUsername }),
  })
}

export async function removePassword(): Promise<void> {
  return request('/api/auth/password', {
    method: 'DELETE',
  })
}

export interface TotpStatus {
  totpEnabled: boolean
}

export interface TotpSetupResponse {
  secret: string
  otpauthUri: string
  qrDataUri: string
}

export async function fetchTotpStatus(): Promise<TotpStatus> {
  const res = await fetch('/api/auth/totp/status')
  if (!res.ok) throw new Error('Failed to fetch TOTP status')
  return res.json()
}

export async function loginWithTotp(token: string): Promise<string> {
  const res = await fetch('/api/auth/totp/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'TOTP login failed')
  }
  const data = await res.json()
  return data.token
}

export async function setupTotp(): Promise<TotpSetupResponse> {
  return request('/api/auth/totp/setup', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function activateTotp(secret: string, code: string): Promise<void> {
  return request('/api/auth/totp/verify', {
    method: 'POST',
    body: JSON.stringify({ secret, token: code }),
  })
}

export async function disableTotp(): Promise<void> {
  return request('/api/auth/totp', {
    method: 'DELETE',
  })
}
