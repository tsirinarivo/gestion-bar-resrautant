import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import { createServer } from 'http'
import { Server } from 'socket.io'
import rateLimit from 'express-rate-limit'

import { authRouter } from './routes/auth'
import { restaurantRouter } from './routes/restaurants'
import { categoryRouter } from './routes/categories'
import { productRouter } from './routes/products'
import { orderRouter } from './routes/orders'
import { tableRouter } from './routes/tables'
import { reservationRouter } from './routes/reservations'
import { stockRouter } from './routes/stock'
import { customerRouter } from './routes/customers'
import { employeeRouter } from './routes/employees'
import { dashboardRouter } from './routes/dashboard'
import { paymentRouter } from './routes/payments'
import { couponRouter } from './routes/coupons'
import { publicRouter } from './routes/public'
import { supplierRouter } from './routes/suppliers'
import { financesRouter } from './routes/finances'
import { printerRouter } from './routes/printer'
import { warehouseRouter } from './routes/warehouses'
import { caisseRouter } from './routes/caisse'
import { bankRouter } from './routes/bank'
import { posTerminalRouter } from './routes/pos-terminals'
import { errorHandler } from './middleware/errorHandler'
import { setupSocketHandlers } from './socket/handlers'
import { prisma } from './lib/prisma'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    credentials: true,
  },
})

// ─── Middleware ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1)
app.use(helmet())
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(cookieParser())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true,
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' },
})

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/public', publicRouter)
app.use('/api/auth', authLimiter, authRouter)
app.use('/api/restaurants', restaurantRouter)
app.use('/api/categories', categoryRouter)
app.use('/api/products', productRouter)
app.use('/api/orders', orderRouter)
app.use('/api/tables', tableRouter)
app.use('/api/reservations', reservationRouter)
app.use('/api/stock', stockRouter)
app.use('/api/customers', customerRouter)
app.use('/api/employees', employeeRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/payments', paymentRouter)
app.use('/api/coupons', couponRouter)
app.use('/api/suppliers', supplierRouter)
app.use('/api/finances', financesRouter)
app.use('/api/printer', printerRouter)
app.use('/api/warehouses', warehouseRouter)
app.use('/api/caisse', caisseRouter)
app.use('/api/bank', bankRouter)
app.use('/api/pos-terminals', posTerminalRouter)

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' })
  }
})

app.use(errorHandler)

// ─── Socket.io ────────────────────────────────────────────────────────────────

app.set('io', io)
setupSocketHandlers(io)

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000

async function main() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')

    httpServer.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`)
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

main()

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})
