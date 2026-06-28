import { describe, it, expect } from 'vitest'
import {
  formatMB,
  describeUploadError,
  compressImage,
  compressImages,
  MAX_FILE_SIZE,
} from './imageCompress'

describe('formatMB', () => {
  it('formats bytes as MB with 2 decimals', () => {
    expect(formatMB(5 * 1024 * 1024)).toBe('5.00')
    expect(formatMB(1.5 * 1024 * 1024)).toBe('1.50')
  })

  it('MAX_FILE_SIZE is 5 MB', () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
  })
})

describe('describeUploadError', () => {
  it('handles timeout via error code', () => {
    expect(describeUploadError({ code: 'ECONNABORTED' })).toMatch(/timed out/i)
  })

  it('handles timeout via message text', () => {
    expect(describeUploadError({ message: 'timeout of 60000ms exceeded' })).toMatch(/timed out/i)
  })

  it('handles 413 too-large and includes total size when provided', () => {
    const msg = describeUploadError({ response: { status: 413 } }, 6 * 1024 * 1024)
    expect(msg).toMatch(/too large/i)
    expect(msg).toContain('6.00 MB')
  })

  it('handles too-large via server message text', () => {
    expect(
      describeUploadError({ response: { data: { error: 'LIMIT_FILE_SIZE' } } }),
    ).toMatch(/too large/i)
  })

  it('handles network errors', () => {
    expect(describeUploadError({ code: 'ERR_NETWORK' })).toMatch(/network error/i)
  })

  it('handles 5xx server errors and includes the status', () => {
    expect(describeUploadError({ response: { status: 503 } })).toContain('503')
  })

  it('passes through a custom API error message', () => {
    expect(
      describeUploadError({ response: { data: { error: 'Vendor is inactive' } } }),
    ).toBe('Vendor is inactive')
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(describeUploadError({})).toMatch(/something went wrong/i)
  })
})

describe('compressImage (skip paths — no canvas needed)', () => {
  it('returns the same file when it is not an image', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' })
    expect(await compressImage(file)).toBe(file)
  })

  it('returns the same file when it is below the skip threshold', async () => {
    const small = new File([new Uint8Array(10)], 'tiny.png', { type: 'image/png' })
    expect(await compressImage(small)).toBe(small)
  })
})

describe('compressImages', () => {
  it('maps each file through compressImage', async () => {
    const a = new File(['a'], 'a.txt', { type: 'text/plain' })
    const b = new File([new Uint8Array(5)], 'b.png', { type: 'image/png' })
    const out = await compressImages([a, b])
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(a)
    expect(out[1]).toBe(b)
  })
})
