export const MAX_FILE_SIZE = 5 * 1024 * 1024
const LONGEST_EDGE = 1600
const QUALITY = 0.8
const SKIP_BELOW = 1024 * 1024

export const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2)

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

async function decode(file: File): Promise<Decoded | null> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) })
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export async function compressImage(file: File): Promise<File> {
  if (!file || !file.type?.startsWith('image/') || file.size < SKIP_BELOW) return file
  let decoded: Decoded | null = null
  let canvas: HTMLCanvasElement | null = null
  try {
    decoded = await decode(file)
    if (!decoded || !decoded.width || !decoded.height) return file
    const scale = Math.min(1, LONGEST_EDGE / Math.max(decoded.width, decoded.height))
    const w = Math.max(1, Math.round(decoded.width * scale))
    const h = Math.max(1, Math.round(decoded.height * scale))
    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(decoded.source, 0, 0, w, h)
    decoded.close()
    decoded = null
    const blob: Blob | null = await new Promise((res) => canvas!.toBlob(res, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file
    const base = file.name.replace(/\.[^.]+$/, '') || 'receipt'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  } finally {
    decoded?.close()
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}

export async function compressImages(files: File[]): Promise<File[]> {
  const out: File[] = []
  for (const f of files) {
    out.push(await compressImage(f))
  }
  return out
}

export function describeUploadError(err: unknown, totalBytes = 0): string {
  const e = err as { response?: { status?: number; data?: { error?: string; message?: string } }; code?: string; message?: string }
  const status = e?.response?.status
  const apiMsg = e?.response?.data?.error || e?.response?.data?.message
  const code = e?.code
  const raw = (apiMsg || e?.message || '').toLowerCase()

  if (code === 'ECONNABORTED' || raw.includes('timeout')) return 'Upload timed out. Try again on a stronger network.'
  if (status === 413 || raw.includes('too large') || raw.includes('limit_file_size')) {
    const t = totalBytes ? ` (total ${formatMB(totalBytes)} MB)` : ''
    return `File too large for the server (max 5 MB per file)${t}. Remove or retake the largest bill and try again.`
  }
  if (code === 'ERR_NETWORK' || raw.includes('network error')) return 'Network error — check your connection and try again.'
  if (status && status >= 500) return `Server error (${status}). Please retry in a moment.`
  return apiMsg || 'Something went wrong. Please try again.'
}
