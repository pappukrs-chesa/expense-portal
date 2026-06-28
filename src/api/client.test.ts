import { describe, it, expect } from 'vitest'
import { API_BASE, OTP_BASE, billFileUrl, endpoints } from './client'

describe('billFileUrl', () => {
  it('prefixes a path with the API base', () => {
    expect(billFileUrl('/uploads/bill.jpg')).toBe(`${API_BASE}/uploads/bill.jpg`)
  })

  it('returns null for null/undefined/empty paths', () => {
    expect(billFileUrl(null)).toBeNull()
    expect(billFileUrl(undefined)).toBeNull()
    expect(billFileUrl('')).toBeNull()
  })
})

describe('endpoints', () => {
  it('builds the concern lookup path from a mobile number', () => {
    expect(endpoints.concernLookup('9876543210')).toBe(
      '/production-expense/concern/9876543210',
    )
  })

  it('exposes the expected static endpoints', () => {
    expect(endpoints.sendOtp).toBe('/send-otp')
    expect(endpoints.verifyOtp).toBe('/verify-otp')
    expect(endpoints.expenses).toBe('/production-expense')
  })
})

describe('API bases', () => {
  it('default API and OTP bases are https URLs', () => {
    expect(API_BASE).toMatch(/^https:\/\//)
    expect(OTP_BASE).toMatch(/^https:\/\//)
  })
})
