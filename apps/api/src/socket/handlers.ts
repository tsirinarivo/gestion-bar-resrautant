import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export function setupSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      socket.data.restaurantId = socket.handshake.auth.restaurantId
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

    socket.on('join:kds', (data: { restaurantId: string }) => {
      socket.join(`kds-${data.restaurantId}`)
    })

    socket.on('kds:item_ready', (data: { orderId: string; itemId: string; restaurantId: string }) => {
      io.to(data.restaurantId).emit('kds:item_prepared', data)
    })

    socket.on('table:call_waiter', (data: { tableId: string; restaurantId: string }) => {
      io.to(data.restaurantId).emit('table:waiter_requested', data)
    })
  })
}
