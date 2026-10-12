import React, { useEffect, useState, useRef } from 'react'
import kkjOfficialLogo from '@/assets/logo-3d-de-escudo-azul-e-prata-b5e2e.png'

interface KkjOfficialShieldProps {
  className?: string
  size?: number
  alt?: string
}

let cachedShieldUrl: string | null = null

/**
 * Escudo Oficial KK JEKABSON extraído diretamente do logo oficial anexado
 * Proporções 100% fiéis, acabamento prateado 3D chanfrado com check azul oficial.
 */
export function KkjOfficialShield({
  className = 'h-6 w-6 object-contain',
  size,
  alt = 'Escudo Oficial KKJ',
}: KkjOfficialShieldProps) {
  const [shieldUrl, setShieldUrl] = useState<string>(() => cachedShieldUrl || '')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (cachedShieldUrl) {
      setShieldUrl(cachedShieldUrl)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = kkjOfficialLogo

    img.onload = () => {
      try {
        const fullCanvas = document.createElement('canvas')
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        fullCanvas.width = w
        fullCanvas.height = h
        const ctx = fullCanvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, w, h)
        const data = imgData.data
        const totalPixels = w * h

        // Sample background
        const cornerR = (data[0] + data[(w - 1) * 4] + data[(h - 1) * w * 4]) / 3
        const cornerG = (data[1] + data[(w - 1) * 4 + 1] + data[(h - 1) * w * 4 + 1]) / 3
        const cornerB = (data[2] + data[(w - 1) * 4 + 2] + data[(h - 1) * w * 4 + 2]) / 3
        const cornerBright = (cornerR + cornerG + cornerB) / 3

        const isWhiteBg = cornerBright > 220
        const isDarkBg = cornerBright < 35

        if (isWhiteBg) {
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const minC = Math.min(r, g, b)
            const maxC = Math.max(r, g, b)
            const diff = maxC - minC
            if (minC > 248 && diff < 10) {
              data[idx + 3] = 0
            } else if (minC > 225 && diff < 18) {
              const alphaFactor = (255 - minC) / 30
              data[idx + 3] = Math.round(data[idx + 3] * Math.max(0, Math.min(1, alphaFactor)))
            }
          }
        } else if (isDarkBg) {
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const maxC = Math.max(r, g, b)
            const minC = Math.min(r, g, b)
            const diff = maxC - minC
            if (maxC < 10) {
              data[idx + 3] = 0
            } else if (maxC < 30 && diff < 12) {
              const alphaFactor = (maxC - 8) / 22
              data[idx + 3] = Math.round(data[idx + 3] * Math.max(0, Math.min(1, alphaFactor)))
            }
          }
        }

        // Crop bounding box of shield (shield is in the top 66% of image)
        const shieldMaxY = Math.floor(h * 0.68)
        let minX = w,
          maxX = 0,
          minY = h,
          maxY = 0

        for (let y = 0; y < shieldMaxY; y++) {
          for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3]
            if (a > 25) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }

        if (maxX <= minX || maxY <= minY) {
          // Fallback box
          minX = Math.floor(w * 0.25)
          maxX = Math.floor(w * 0.75)
          minY = Math.floor(h * 0.05)
          maxY = Math.floor(h * 0.65)
        }

        // Add padding
        const pad = 4
        const sMinX = Math.max(0, minX - pad)
        const sMaxX = Math.min(w - 1, maxX + pad)
        const sMinY = Math.max(0, minY - pad)
        const sMaxY = Math.min(h - 1, maxY + pad)
        const sw = sMaxX - sMinX + 1
        const sh = sMaxY - sMinY + 1

        const shieldCanvas = document.createElement('canvas')
        shieldCanvas.width = sw
        shieldCanvas.height = sh
        const sCtx = shieldCanvas.getContext('2d')
        if (!sCtx) return

        sCtx.putImageData(imgData, -sMinX, -sMinY, 0, 0, sw, sh)
        const resultUrl = shieldCanvas.toDataURL('image/png')
        cachedShieldUrl = resultUrl
        setShieldUrl(resultUrl)
      } catch (err) {
        console.warn('Shield crop fallback', err)
      }
    }
  }, [])

  const style: React.CSSProperties = size ? { width: size, height: size } : {}

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      {shieldUrl ? (
        <img src={shieldUrl} alt={alt} style={style} className={className} loading="eager" />
      ) : (
        // High quality fallback vector shield while canvas processes in <16ms
        <svg
          style={style}
          viewBox="0 0 100 115"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-label={alt}
        >
          <defs>
            <linearGradient id="fallbackSilverOuter" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#D8DCE3" />
              <stop offset="50%" stopColor="#9AA2AF" />
              <stop offset="75%" stopColor="#E2E5EA" />
              <stop offset="100%" stopColor="#808896" />
            </linearGradient>
            <linearGradient id="fallbackSilverFace" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#0B2559" />
              <stop offset="50%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <linearGradient id="fallbackBlueCheck" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <path
            d="M50 3 L88 18 C88 56 73 88 50 108 C27 88 12 56 12 18 L50 3 Z"
            fill="url(#fallbackSilverOuter)"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <path
            d="M50 9 L82 22 C82 54 69 82 50 99 C31 82 18 54 18 22 L50 9 Z"
            fill="url(#fallbackSilverFace)"
          />
          <path
            d="M32 52 L44 65 L68 39"
            stroke="url(#fallbackBlueCheck)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  )
}
