import type { CrmTag } from '@/types/crm'

export const DEFAULT_CRM_TAGS: CrmTag[] = [
  {
    id: 'tag-saude',
    name: 'Saúde',
    color: '#2563EB',
    bg_color: '#EFF6FF',
    text_color: '#1D4ED8',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-pme',
    name: 'PME',
    color: '#16A34A',
    bg_color: '#F0FDF4',
    text_color: '#15803D',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-pf',
    name: 'PF',
    color: '#9333EA',
    bg_color: '#FAF5FF',
    text_color: '#7E22CE',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-adesao',
    name: 'Adesão',
    color: '#EA580C',
    bg_color: '#FFF7ED',
    text_color: '#C2410C',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-trafego-pago',
    name: 'Tráfego pago',
    color: '#DB2777',
    bg_color: '#FDF2F8',
    text_color: '#BE185D',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-bni',
    name: 'BNI',
    color: '#CA8A04',
    bg_color: '#FEFCE8',
    text_color: '#A16207',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-indicacao',
    name: 'Indicação',
    color: '#0891B2',
    bg_color: '#ECFEFF',
    text_color: '#0E7490',
    is_system: true,
    active: true,
  },
  {
    id: 'tag-renovacao',
    name: 'Renovação',
    color: '#4B5563',
    bg_color: '#F3F4F6',
    text_color: '#374151',
    is_system: true,
    active: true,
  },
]

const STORAGE_KEY = 'crm_kkj_custom_tags'

export const tagService = {
  getAllTags(): CrmTag[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: CrmTag[] = JSON.parse(stored)
        // Combine system tags with custom tags, avoiding duplicates
        const systemIds = new Set(DEFAULT_CRM_TAGS.map((t) => t.id))
        const custom = parsed.filter((t) => !systemIds.has(t.id))
        return [...DEFAULT_CRM_TAGS, ...custom]
      }
    } catch {
      // fallback
    }
    return DEFAULT_CRM_TAGS
  },

  createTag(name: string, color?: string): CrmTag {
    const all = this.getAllTags()
    const trimmed = name.trim()
    const existing = all.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      return existing
    }

    const baseColor = color || '#0284C7'
    const newTag: CrmTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      color: baseColor,
      bg_color: `${baseColor}15`,
      text_color: baseColor,
      is_system: false,
      active: true,
      created_at: new Date().toISOString(),
    }

    const updated = [...all, newTag]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return newTag
  },

  updateTag(id: string, updates: Partial<CrmTag>): CrmTag | null {
    const all = this.getAllTags()
    const idx = all.findIndex((t) => t.id === id)
    if (idx === -1) return null

    const updatedTag: CrmTag = {
      ...all[idx],
      ...updates,
      bg_color: updates.color ? `${updates.color}15` : all[idx].bg_color,
      text_color: updates.color || all[idx].text_color,
    }

    all[idx] = updatedTag
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return updatedTag
  },

  toggleActive(id: string): boolean {
    const all = this.getAllTags()
    const tag = all.find((t) => t.id === id)
    if (!tag) return false
    tag.active = !tag.active
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return tag.active
  },

  getTagByName(name: string): CrmTag | undefined {
    const all = this.getAllTags()
    return all.find((t) => t.name.toLowerCase() === name.trim().toLowerCase())
  },
}
