import type { Session, Category } from '../db/types'

const MIN_SESSION_DURATION_MS = 3000

function categoryName(id: number | null | undefined, categories: Category[]): string {
  return categories.find((c) => c.id === id)?.name ?? 'Uncategorized'
}

function categorizeProductivity(id: number | null | undefined, categories: Category[]): number {
  return categories.find((c) => c.id === id)?.productivity ?? 0
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** CSV: started_at, ended_at, app_name, domain, window_title, category, productivity, duration_ms */
export function sessionsToCsv(sessions: Session[], categories: Category[]): string {
  const header = 'started_at,ended_at,app_name,domain,window_title,category,productivity,duration_ms'
  const rows: string[] = [header]

  for (const s of sessions) {
    if (s.ended_at - s.started_at < MIN_SESSION_DURATION_MS) continue
    rows.push(
      [
        String(s.started_at),
        String(s.ended_at),
        escapeCsv(s.app_name),
        escapeCsv(s.domain ?? ''),
        escapeCsv(s.window_title ?? ''),
        escapeCsv(categoryName(s.category_id, categories)),
        String(categorizeProductivity(s.category_id, categories)),
        String(s.ended_at - s.started_at)
      ].join(',')
    )
  }
  return rows.join('\n')
}

/** JSON: array of session objects enriched with category name. */
export function sessionsToJson(sessions: Session[], categories: Category[]): string {
  const items = sessions
    .filter((s) => s.ended_at - s.started_at >= MIN_SESSION_DURATION_MS)
    .map((s) => ({
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_ms: s.ended_at - s.started_at,
      app_name: s.app_name,
      domain: s.domain ?? null,
      window_title: s.window_title ?? null,
      category: categoryName(s.category_id, categories),
      productivity: categorizeProductivity(s.category_id, categories)
    }))
  return JSON.stringify(items, null, 2)
}
