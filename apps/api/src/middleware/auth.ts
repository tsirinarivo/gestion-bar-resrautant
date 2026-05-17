import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
    restaurantId: string
    roleId: string
    roleName: string
  }
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.accessToken

    if (!token) {
      return res.status(401).json({ success: false, error: 'Token manquant' })
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      restaurantId: string
      roleId: string
      roleName: string
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    })

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Utilisateur non autorisé' })
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      restaurantId: user.restaurantId,
      roleId: user.roleId,
      roleName: user.role.name,
    }

    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré' })
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Non authentifié' })
    }

    if (roles.length > 0 && !roles.includes(req.user.roleName)) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé - permissions insuffisantes',
      })
    }

    next()
  }
}

export function sameRestaurant(req: AuthRequest, res: Response, next: NextFunction) {
  const restaurantId = req.params.restaurantId || req.body.restaurantId || req.query.restaurantId

  if (restaurantId && restaurantId !== req.user?.restaurantId && req.user?.roleName !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Accès refusé à cet établissement' })
  }

  next()
}
