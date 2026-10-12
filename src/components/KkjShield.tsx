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
import { KkjOfficialShield } from '@/components/KkjOfficialShield'

export function KkjShield({ className = 'h-6 w-6', size = 24 }: KkjShieldProps) {
  return <KkjOfficialShield className={className} size={size} alt="Escudo Oficial KKJ" />
}
