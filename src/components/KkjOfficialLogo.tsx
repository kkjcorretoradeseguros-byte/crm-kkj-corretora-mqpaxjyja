import React, { useEffect, useState, useRef } from 'react'
import kkjOfficialLogo from '@/assets/logo-3d-de-escudo-azul-e-prata-b5e2e.png'

interface KkjOfficialLogoProps {
  className?: string
  alt?: string
}

// In-memory cache for processed transparent data URLs
let cachedFullLogoUrl: string | null = null

export function KkjOfficialLogo({
  className = 'w-full h-auto',
  alt = 'KK JEKABSON — Corretora de Seguros',
}: KkjOfficialLogoProps) {
  const [dataUrl, setDataUrl] = useState<string>(() => cachedFullLogoUrl || '')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (cachedFullLogoUrl) {
      setDataUrl(cachedFullLogoUrl)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = kkjOfficialLogo

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, w, h)
        const data = imgData.data
        const totalPixels = w * h

        // Sample border pixels to detect background
        // The uploaded image is either on white background or deep black/dark navy
        const cornerR = (data[0] + data[(w - 1) * 4] + data[(h - 1) * w * 4]) / 3
        const cornerG = (data[1] + data[(w - 1) * 4 + 1] + data[(h - 1) * w * 4 + 1]) / 3
        const cornerB = (data[2] + data[(w - 1) * 4 + 2] + data[(h - 1) * w * 4 + 2]) / 3
        const cornerBright = (cornerR + cornerG + cornerB) / 3

        const isWhiteBg = cornerBright > 220
        const isDarkBg = cornerBright < 35

        if (isWhiteBg) {
          // Remove white background with smooth feathering
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const minC = Math.min(r, g, b)
            const maxC = Math.max(r, g, b)
            const diff = maxC - minC

            // If it is near white
            if (minC > 248 && diff < 10) {
              data[idx + 3] = 0
            } else if (minC > 225 && diff < 18) {
              // Smooth feathering
              const alphaFactor = (255 - minC) / 30
              data[idx + 3] = Math.round(data[idx + 3] * Math.max(0, Math.min(1, alphaFactor)))
            }
          }
        } else if (isDarkBg) {
          // Remove dark / black border halo with smooth feathering so it blends seamlessly
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

        ctx.putImageData(imgData, 0, 0)
        const resultUrl = canvas.toDataURL('image/png')
        cachedFullLogoUrl = resultUrl
        setDataUrl(resultUrl)
      } catch (e) {
        console.warn('Canvas logo processing fallback to raw image', e)
        setDataUrl(kkjOfficialLogo)
      }
    }

    img.onerror = () => {
      setDataUrl(kkjOfficialLogo)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <img src={dataUrl || kkjOfficialLogo} alt={alt} className={className} loading="eager" />
    </>
  )
}
