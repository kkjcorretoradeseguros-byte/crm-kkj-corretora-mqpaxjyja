import React from 'react'

interface KkjShieldProps {
  className?: string
  size?: number
}

/**
 * Escudo Oficial KKJ Corretora de Seguros
 * Acabamento prateado chanfrado/metálico com gradiente sutil e check azul oficial KKJ.
 * Proporções vetoriais fiéis ao manual de identidade da marca KKJ.
 */
export function KkjShield({ className = 'h-6 w-6', size = 24 }: KkjShieldProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Escudo Oficial KKJ"
    >
      <defs>
        {/* Gradiente Metálico Prateado para a Borda Externa */}
        <linearGradient id="kkjSilverOuter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="25%" stopColor="#D8DCE3" />
          <stop offset="50%" stopColor="#9AA2AF" />
          <stop offset="75%" stopColor="#E2E5EA" />
          <stop offset="100%" stopColor="#808896" />
        </linearGradient>

        {/* Gradiente Prateado para a Face Interna do Escudo */}
        <linearGradient id="kkjSilverFace" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="40%" stopColor="#E5E7EB" />
          <stop offset="70%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* Gradiente Azul Real para o Check Oficial KKJ */}
        <linearGradient id="kkjBlueCheck" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Sombra de profundidade */}
        <filter
          id="kkjShieldShadow"
          x="-10%"
          y="-10%"
          width="120%"
          height="125%"
          filterUnits="userSpaceOnUse"
        >
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" floodColor="#0F172A" />
        </filter>
      </defs>

      <g filter="url(#kkjShieldShadow)">
        {/* Contorno / Moldura Chanfrada Prateada do Escudo */}
        <path
          d="M50 3 L88 18 C88 56 73 88 50 108 C27 88 12 56 12 18 L50 3 Z"
          fill="url(#kkjSilverOuter)"
          stroke="#64748B"
          strokeWidth="1.5"
        />

        {/* Face Central do Escudo com reflexo prateado */}
        <path
          d="M50 9 L82 22 C82 54 69 82 50 99 C31 82 18 54 18 22 L50 9 Z"
          fill="url(#kkjSilverFace)"
        />

        {/* Chanfro de reflexo vertical (metade esquerda sutilmente mais clara) */}
        <path d="M50 9 L18 22 C18 54 31 82 50 99 Z" fill="#FFFFFF" fillOpacity="0.18" />

        {/* Check Azul Oficial KKJ */}
        <path
          d="M32 52 L44 65 L68 39"
          stroke="url(#kkjBlueCheck)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
