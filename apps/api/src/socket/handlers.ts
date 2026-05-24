import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      // Allow unauthenticated connections for public client app (QR waiter call)
      // but scope restaurantId from handshake only — never from emitted event data
      socket.data.restaurantId = socket.handshake.auth.restaurantId
      socket.data.isPublic = true
      return next()
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
      socket.data.userId = payload.userId
      socket.data.restaurantId = payload.restaurantId
      socket.data.roleName = payload.roleName
      next()
    } catch {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const { restaurantId, roleName } = socket.data

    if (restaurantId) {
      socket.join(restaurantId)
      if (roleName === 'cuisinier') socket.join(`kds-${restaurantId}`)
      if (['manager', 'superadmin'].includes(roleName)) socket.join(`admin-${restaurantId}`)
    }

    socket.on('join:kds', () => {
      const rId = socket.data.restaurantId
      if (rId) socket.join(`kds-${rId}`)
    })

    socket.on('kds:item_ready', (data: { orderId: string; itemId: string; restaurantId?: string }) => {
      const rId = socket.data.restaurantId
      if (rId) io.to(rId).emit('kds:item_prepared', { ...data, restaurantId: rId })
    })

    socket.on('table:call_waiter', (data: { tableId: string; restaurantId?: string }) => {
      const rId = socket.data.restaurantId
      if (rId) io.to(rId).emit('table:waiter_requested', { ...data, restaurantId: rId })
    })
  })
}
