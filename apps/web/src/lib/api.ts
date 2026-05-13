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

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
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
      } catch {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
