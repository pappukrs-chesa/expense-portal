import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'https://api.chesadentalcare.com'

export const API_BASE = baseURL

export const api = axios.create({ baseURL, timeout: 60000 })

export const OTP_BASE = 'https://apis.chesadentalcare.com'

export const otpApi = axios.create({ baseURL: OTP_BASE, timeout: 60000 })

export const billFileUrl = (path?: string | null) => (path ? `${baseURL}${path}` : null)

export const endpoints = {
  concernLookup: (mobile: string) => `/production-expense/concern/${mobile}`,
  sendOtp: '/send-otp',
  verifyOtp: '/verify-otp',
  categories: '/production-expense/categories',
  vendors: '/production-expense/vendors',
  expenses: '/production-expense',
}
