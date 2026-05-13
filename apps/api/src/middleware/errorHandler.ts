import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err)

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Données invalides',
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
    return res.status(statusCode).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message,
    })
  }

  return res.status(500).json({ success: false, error: 'Erreur interne du serveur' })
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
