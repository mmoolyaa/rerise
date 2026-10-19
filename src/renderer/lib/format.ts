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
