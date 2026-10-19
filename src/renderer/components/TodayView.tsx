import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { Session, Category, TodaySummary } from '../types'
import { formatDuration, formatClock, categoryColor, categoryName, scoreTone } from '../lib/format'
import { Card, CardHeader, Stat } from './ui'

function ScoreCircle({ score }: { score: number | null }) {
  const display = score === null ? '--' : Math.round(score)
  const circumference = 2 * Math.PI * 44
  const progress = score === null ? 0 : (score / 100) * circumference
  const strokeColor =
    score === null ? '#4b5563' : score >= 60 ? '#10b981' : score >= 40 ? '#eab308' : '#f43f5e'

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className="stroke-gray-100 dark:stroke-white/[0.06]" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums ${score === null ? 'text-gray-400 dark:text-gray-600' : scoreTone(score)}`}>
          {display}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-500 -mt-0.5">productivity</span>
      </div>
    </div>
  )
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function Timeline({ sessions, categories, dayStartMs }: {
  sessions: Session[]
  categories: Category[]
  dayStartMs: number
}) {
  const dayMs = 24 * 60 * 60 * 1000
  const now = Date.now()
  const nowPct = now >= dayStartMs && now < dayStartMs + dayMs ? ((now - dayStartMs) / dayMs) * 100 : null
  const gridlines = Array.from({ length: 25 }, (_, h) => h)

  return (
    <Card>
      <CardHeader
        title="Timeline"
        right={
          <div className="flex gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-500 not-italic" />Productive</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-rose-500 not-italic" />Unproductive</span>
            <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-slate-500 not-italic" />Neutral</span>
          </div>
        }
      />
      <div className="px-4 pb-3">
        <div className="relative h-14 rounded-lg overflow-hidden bg-gray-100/80 dark:bg-white/[0.03]">
          {gridlines.map((h) => (
            <div
              key={h}
              className={`absolute top-0 bottom-0 w-px ${h % 3 === 0 ? 'bg-gray-200 dark:bg-white/[0.08]' : 'bg-gray-100 dark:bg-white/[0.04]'}`}
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}
          {sessions.map((s, i) => {
            const left = ((s.started_at - dayStartMs) / dayMs) * 100
            const width = Math.max(0.15, ((s.ended_at - s.started_at) / dayMs) * 100)
            return (
              <div
                key={i}
                className="absolute top-1 h-12 rounded-[3px] opacity-90 hover:opacity-100 transition-opacity"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: categoryColor(s.category_id), zIndex: 10 }}
                title={`${s.app_name}${s.domain ? ` — ${s.domain}` : ''} — ${categoryName(s.category_id, categories)}\n${formatClock(s.started_at)} – ${formatClock(s.ended_at)} (${formatDuration(s.ended_at - s.started_at)})`}
              />
            )
          })}
          {nowPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-indigo-500 z-20"
              style={{ left: `${nowPct}%` }}
              title="now"
            />
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 dark:text-gray-600 tabular-nums">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h}>{hourLabel(h % 24)}</span>
          ))}
        </div>
      </div>
    </Card>
  )
}

function ProductivityMix({ sessions, categories }: { sessions: Session[]; categories: Category[] }) {
  const prodMap = new Map(categories.map((c) => [c.id, c.productivity]))
  let productive = 0
  let neutral = 0
  let unproductive = 0
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    const p = s.category_id ? prodMap.get(s.category_id) : 0
    if (p === undefined) continue
    if (p > 0) productive += dur
    else if (p < 0) unproductive += dur
    else neutral += dur
  }
  const total = productive + neutral + unproductive
  if (total === 0) return <div className="text-sm text-gray-500 dark:text-gray-500 px-4 pb-4">No tracked time yet today.</div>

  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`
  const seg = (v: number, color: string, label: string) =>
    v === 0 ? null : (
      <div className="h-2.5 first:rounded-l-full last:rounded-r-full" style={{ width: pct(v), backgroundColor: color }} title={`${label}: ${formatDuration(v)} (${pct(v)})`} />
    )

  return (
    <div className="px-4 pb-4">
      <div className="flex w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.03]">
        {seg(productive, '#10b981', 'Productive')}
        {seg(neutral, '#64748b', 'Neutral')}
        {seg(unproductive, '#f43f5e', 'Unproductive')}
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span>{formatDuration(productive)} productive</span>
        <span>{formatDuration(neutral)} neutral</span>
        <span>{formatDuration(unproductive)} unproductive</span>
      </div>
    </div>
  )
}

function Donut({ sessions, categories }: { sessions: Session[]; categories: Category[] }) {
  const byCat = new Map<number, number>()
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < 3000) continue
    const key = s.category_id ?? 8
    byCat.set(key, (byCat.get(key) ?? 0) + dur)
  }
  const data = [...byCat.entries()].map(([id, value]) => {
    const cat = categories.find((c) => c.id === id)
    return { name: cat?.name ?? 'Neutral', value, color: categoryColor(id) }
  })

  if (data.length === 0) {
    return <div className="text-xs text-gray-500 dark:text-gray-500 px-4 pb-4">No data yet</div>
  }

  return (
    <div className="px-2 pb-3">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 px-3 pb-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="truncate text-gray-600 dark:text-gray-300 flex-1">{d.name}</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400 shrink-0">{formatDuration(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Dominant (longest-duration) category per app name / domain for the top lists
function dominantCategoryMap(sessions: Session[], kind: 'app' | 'site'): Map<string, number> {
  const acc = new Map<string, Map<number, number>>()
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < 3000) continue
    if (!s.category_id) continue
    const key = kind === 'app' ? s.app_name : s.domain
    if (!key) continue
    let inner = acc.get(key)
    if (!inner) acc.set(key, (inner = new Map()))
    inner.set(s.category_id, (inner.get(s.category_id) ?? 0) + dur)
  }
  const out = new Map<string, number>()
  for (const [key, cats] of acc) {
    out.set(key, [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0])
  }
  return out
}

function TopList({ entries, dominant, categories, emptyLabel }: {
  entries: { name: string; durationMs: number }[]
  dominant: Map<string, number>
  categories: Category[]
  emptyLabel: string
}) {
  if (entries.length === 0) {
    return <div className="text-xs text-gray-500 dark:text-gray-500 px-4 pb-4 py-2">{emptyLabel}</div>
  }
  const max = entries[0].durationMs || 1
  return (
    <div className="space-y-2.5 px-4 pb-4">
      {entries.map((e) => {
        const catId = dominant.get(e.name)
        const dot = catId ? { backgroundColor: categoryColor(catId) } : { backgroundColor: '#4b5563' }
        return (
          <div key={e.name}>
            <div className="flex justify-between text-xs mb-1 gap-2">
              <span className="truncate max-w-[60%] text-gray-700 dark:text-gray-200">{e.name}</span>
              <span className="flex items-center gap-1.5 shrink-0 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={dot} />
                <span className="text-gray-500 dark:text-gray-500 truncate max-w-[90px]">
                  {catId ? categoryName(catId, categories) : 'Neutral'}
                </span>
                <span className="tabular-nums text-gray-500 dark:text-gray-400">{formatDuration(e.durationMs)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.05]">
              <div className="h-full rounded-full bg-indigo-500/80" style={{ width: `${(e.durationMs / max) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TodayView({
  summary,
  sessions,
  categories,
  dayStartMs
}: {
  summary: TodaySummary | null
  sessions: Session[]
  categories: Category[]
  dayStartMs: number
}) {
  return (
    <div className="grid lg:grid-cols-[1fr_17rem] gap-4 items-start">
      {/* Main column */}
      <div className="space-y-4 min-w-0">
        <Card className="p-4">
          <div className="flex items-center gap-5">
            <ScoreCircle score={summary?.score ?? null} />
            <div className="grid grid-cols-2 gap-2 flex-1">
              <Stat label="Tracked time" value={summary ? formatDuration(summary.trackedTimeMs) : '--'} />
              <Stat label="Focus time" value={summary ? formatDuration(summary.focusTimeMs) : '--'} />
              <Stat label="Coverage" value={summary ? `${summary.coveragePercent}%` : '--'} />
              <Stat label="Neutral time" value={summary ? formatDuration(summary.uncategorizedMs) : '--'} />
            </div>
          </div>
        </Card>

        <Timeline sessions={sessions} categories={categories} dayStartMs={dayStartMs} />

        <Card>
          <CardHeader title="Productivity mix" />
          <ProductivityMix sessions={sessions} categories={categories} />
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Top apps" />
            <TopList
              entries={summary?.topApps ?? []}
              dominant={dominantCategoryMap(sessions, 'app')}
              categories={categories}
              emptyLabel="No app activity yet"
            />
          </Card>
          <Card>
            <CardHeader title="Top sites" />
            <TopList
              entries={summary?.topSites ?? []}
              dominant={dominantCategoryMap(sessions, 'site')}
              categories={categories}
              emptyLabel="No site data yet (pair the extension in Settings)"
            />
          </Card>
        </div>
      </div>

      {/* Right panel */}
      <Card className="hidden lg:block">
        <CardHeader title="Breakdown" />
        <Donut sessions={sessions} categories={categories} />
      </Card>
    </div>
  )
}
