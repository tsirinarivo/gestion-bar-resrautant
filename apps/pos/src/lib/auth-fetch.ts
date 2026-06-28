'use client'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

export { API_URL }

// ─── Module-level token state ──────────────────────────────────────────────

let _accessToken: string | null = null
const _tokenListeners = new Set<(t: string | null) => void>()

export function setAccessToken(t: string | null): void {
  if (_accessToken === t) return
  _accessToken = t
  _tokenListeners.forEach(cb => cb(t))
}

export function getAccessToken(): string | null {
  return _accessToken
}

export function subscribeToken(cb: (t: string | null) => void): () => void {
  _tokenListeners.add(cb)
  return () => { _tokenListeners.delete(cb) }
}

// ─── Refresh logic ─────────────────────────────────────────────────────────

let _refreshInFlight: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (_refreshInFlight) return _refreshInFlight

  const p = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null
      const data = await res.json() as { success: boolean; data?: { accessToken: string } }
      if (!data.success || !data.data?.accessToken) return null
      setAccessToken(data.data.accessToken)
      return data.data.accessToken
    } catch {
      return null
    }
  })()

  // Reset synchrone au moment où la promesse résout — pas de setTimeout
  // (sinon micro-fenêtre où 2 refresh concurrents passent).
  _refreshInFlight = p.finally(() => { _refreshInFlight = null })

  return _refreshInFlight
}

// ─── Core authFetch with auto-refresh on 401 ───────────────────────────────

function buildHeaders(init: RequestInit, token: string | null): HeadersInit {
  const h: Record<string, string> = {}
  const provided = (init.headers ?? {}) as Record<string, string>
  for (const k in provided) h[k] = provided[k]!
  if (!h['Content-Type'] && (init.method === 'POST' || init.method === 'PUT' || init.method === 'PATCH')) {
    h['Content-Type'] = 'application/json'
  }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`

  let res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, _accessToken),
  })

  if (res.status !== 401) return res

  // Évite de tenter un refresh sur la route /auth/* elle-même
  if (path.includes('/auth/refresh') || path.includes('/auth/login')) {
    return res
  }

  const newToken = await tryRefresh()
  if (!newToken) {
    setAccessToken(null)
    return res
  }

  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, newToken),
  })
}

// ─── Typed wrappers (drop-in replacement for old apiFetch/apiPost/apiPatch) ──

// La signature garde un paramètre `_token` pour compatibilité avec les call-sites
// existants — il est ignoré (le vrai token vient du module-level state).
export async function apiFetch<T>(_token: string | null | undefined, path: string): Promise<T> {
  const res = await authFetch(`/api${path}`)
  if (res.status === 401) {
    throw Object.assign(new Error('Session expirée, reconnectez-vous'), { status: 401 })
  }
  const data = await res.json() as { success: boolean; data: T; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Erreur API')
  return data.data
}

export async function apiPost<T>(_token: string | null | undefined, path: string, body: unknown): Promise<T> {
  const res = await authFetch(`/api${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json() as { success: boolean; data: T; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Erreur API')
  return data.data
}

export async function apiPatch(_token: string | null | undefined, path: string, body: unknown): Promise<void> {
  const res = await authFetch(`/api${path}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({ success: res.ok })) as { success?: boolean; error?: string }
  if (data.success === false) throw new Error(data.error ?? 'Erreur API')
}

export async function apiDelete(_token: string | null | undefined, path: string, body?: unknown): Promise<void> {
  const res = await authFetch(`/api${path}`, {
    method: 'DELETE',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({ success: res.ok })) as { success?: boolean; error?: string }
  if (data.success === false) throw new Error(data.error ?? 'Erreur API')
}

// ─── Login (pose le cookie refreshToken) ───────────────────────────────────

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json() as { success: boolean; data?: { accessToken: string }; error?: string }
  if (!data.success || !data.data) throw new Error(data.error ?? 'Identifiants incorrects')
  setAccessToken(data.data.accessToken)
  return data.data.accessToken
}
