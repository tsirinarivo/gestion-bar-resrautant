import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err)

  if (err instanceof ZodError) {
    const first = err.errors[0]
    const where = first?.path?.length ? ` (${first.path.join('.')}: ${first.message})` : ''
    return res.status(400).json({
      success: false,
      error: `Données invalides${where}`,
      details: err.errors.reduce((acc, e) => {
        const key = e.path.join('.')
        acc[key] = [e.message]
        return acc
      }, {} as Record<string, string[]>),
    })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Un enregistrement avec ces données existe déjà',
        code: 'DUPLICATE_ENTRY',
      })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Enregistrement introuvable',
        code: 'NOT_FOUND',
      })
    }
  }

  if (err instanceof Error) {
    const statusCode = (err as any).statusCode || 500
    // Les AppError (statusCode < 500) contiennent un message safe destiné au
    // client — toujours le renvoyer. Seules les vraies erreurs 5xx sont masquées
    // en prod (peuvent contenir des détails internes).
    const isClientError = statusCode >= 400 && statusCode < 500
    const safeMessage = isClientError || process.env.NODE_ENV !== 'production'
      ? err.message
      : 'Erreur interne du serveur'
    return res.status(statusCode).json({
      success: false,
      error: safeMessage,
      ...((err as any).code ? { code: (err as any).code } : {}),
    })
  }

  return res.status(500).json({ success: false, error: 'Erreur interne du serveur' })
}

export class AppError extends Error {
  statusCode: number
  code?: string

  constructor(message: string, statusCode = 500, code?: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }
}
