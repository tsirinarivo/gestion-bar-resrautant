import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/errorHandler'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  restaurantId: z.string(),
  roleId: z.string().optional(),
})

function generateTokens(userId: string, restaurantId: string, roleId: string, roleName: string) {
  const accessToken = jwt.sign(
    { userId, restaurantId, roleId, roleName },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any, algorithm: 'HS256' }
  )

  const refreshToken = jwt.sign(
    { userId, restaurantId, roleId, roleName },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any, algorithm: 'HS256' }
  )

  return { accessToken, refreshToken }
}

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    })

    if (!user || !user.isActive) {
      throw new AppError('Email ou mot de passe incorrect', 401)
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new AppError('Email ou mot de passe incorrect', 401)
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.restaurantId, user.roleId, user.role.name)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    const { passwordHash: _, ...userWithoutPassword } = user

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        accessToken,
        expiresIn: 15 * 60,
      },
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!refreshToken) {
      throw new AppError('Refresh token manquant', 401)
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { role: true } } },
    })

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('Refresh token invalide ou expiré', 401)
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!, { algorithms: ['HS256'] }) as any

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      stored.user.id,
      stored.user.restaurantId,
      stored.user.roleId,
      stored.user.role.name
    )

    await prisma.refreshToken.delete({ where: { token: refreshToken } })
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({ success: true, data: { accessToken, expiresIn: 15 * 60 } })
  } catch (error) {
    next(error)
  }
})

// POST /api/auth/logout
authRouter.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }

    res.clearCookie('refreshToken')
    res.json({ success: true, message: 'Déconnexion réussie' })
  } catch (error) {
    next(error)
  }
})

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        employee: true,
      },
    })

    if (!user) {
      throw new AppError('Utilisateur introuvable', 404)
    }

    const { passwordHash: _, ...userWithoutPassword } = user

    res.json({ success: true, data: userWithoutPassword })
  } catch (error) {
    next(error)
  }
})

// PUT /api/auth/me — update profile fields
authRouter.put('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { firstName, lastName, email, avatar, phone } = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      avatar: z.string().url().nullable().optional(),
      phone: z.string().nullable().optional(),
    }).parse(req.body)

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(avatar !== undefined && { avatar }),
        ...(phone !== undefined && { phone }),
      },
    })
    const { passwordHash: _, ...userWithoutPassword } = updated
    res.json({ success: true, data: userWithoutPassword })
  } catch (error) { next(error) }
})

// PUT /api/auth/password
authRouter.put('/password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }).parse(req.body)

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) throw new AppError('Utilisateur introuvable', 404)

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) throw new AppError('Mot de passe actuel incorrect', 400)

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } })

    res.json({ success: true, message: 'Mot de passe modifié avec succès' })
  } catch (error) {
    next(error)
  }
})
