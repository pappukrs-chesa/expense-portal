import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import type { Concern } from '../types'

const KEY = 'ep.concern'
const sample = { id: 1, name: 'Test Concern' } as unknown as Concern

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts logged out when storage is empty', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.concern).toBeNull()
  })

  it('login sets the concern and persists it to localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(sample))
    expect(result.current.concern).toEqual(sample)
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual(sample)
  })

  it('logout clears the concern and removes it from localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(sample))
    act(() => result.current.logout())
    expect(result.current.concern).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('hydrates the concern from localStorage on mount', () => {
    localStorage.setItem(KEY, JSON.stringify(sample))
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.concern).toEqual(sample)
  })

  it('useAuth throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/must be used within/i)
  })
})
