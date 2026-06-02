import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { masterPrisma } from '@restaurant/master-database'

const COOKIE_NAME = 'master_token'
const TTL_SECONDS = 60 * 60 * 12 // 12h

function getSecret(): string {
  const secret = process.env.MASTER_JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('MASTER_JWT_SECRET must be set (>= 32 chars)')
  }
  return secret
}

export type SessionPayload = {
  uid: string
  email: string
  role: 'OWNER' | 'SUPPORT'
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TTL_SECONDS, algorithm: 'HS256' })
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}

export function readSession(): SessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as SessionPayload
  } catch {
    return null
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = readSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

export async function getUser(uid: string) {
  return masterPrisma.masterUser.findUnique({ where: { id: uid } })
}
