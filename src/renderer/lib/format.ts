import type { Category } from '../types'

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.floor(ms / 60000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Color per category id (canonical 3-category model: 8 Neutral, 9 Unproductive, 10 Productive)
export function categoryColor(id: number | null | undefined): string {
  switch (id) {
    case 9: return '#f43f5e' // Unproductive (rose)
    case 10: return '#10b981' // Productive (emerald)
    case 8:
    default: return '#64748b' // Neutral (slate)
  }
}

export function categoryName(id: number | null | undefined, categories: Category[]): string {
  return categories.find((c) => c.id === id)?.name ?? 'Neutral'
}

export function scoreTone(score: number): string {
  if (score >= 80) return 'text-green-500'
  if (score >= 60) return 'text-blue-500'
  if (score >= 40) return 'text-yellow-500'
  if (score >= 20) return 'text-orange-500'
  return 'text-red-500'
}

// Deterministic pastel background for app/site favicon stand-ins
const CHIP_COLORS = ['#c4714b', '#7c6bd6', '#3b8f6c', '#4a7fd4', '#b3569a', '#c9a227', '#5f6b7a']

export function chipColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length]
}

export function chipInitial(name: string): string {
  const s = name.replace(/\.[^.]+$/, '').trim()
  return (s[0] ?? '?').toUpperCase()
}
