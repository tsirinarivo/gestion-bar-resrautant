import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
})

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Ne JAMAIS tenter de refresh sur les routes d'auth elles-mêmes :
    // - /auth/login : un 401 = mauvais credentials, pas de refresh à faire,
    //   sinon spinner infini (le catch redirigeait vers /login sans rejeter
    //   la promesse → la mutation TanStack reste 'pending').
    // - /auth/refresh : si le refresh lui-même renvoie 401, on doit s'arrêter
    //   (sinon boucle infinie de refresh).
    const isAuthRoute = originalRequest?.url?.includes('/auth/login')
      || originalRequest?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
          // Si le refresh échoue, la queue est purgée et on doit aussi
          // rejeter (sinon spinner infini pour les requêtes en attente)
          setTimeout(() => reject(error), 30_000)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await api.post('/auth/refresh')
        const newToken = data.data.accessToken
        localStorage.setItem('accessToken', newToken)

        refreshQueue.forEach((cb) => cb(newToken))
        refreshQueue = []

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshErr) {
        localStorage.removeItem('accessToken')
        refreshQueue = [] // important : purger la queue
        window.location.href = '/login'
        // Reject explicitement sinon les Promise restent pending → spinner infini.
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
