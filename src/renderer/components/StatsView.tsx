import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { TodaySummary, Session, Category, CategorySlice } from '../types'
import { useDayData } from '../hooks/useDayData'
import { useRangeData, type RangeDays } from '../hooks/useRangeData'
import { useDarkMode } from '../hooks/useDarkMode'
import {
  formatDuration,
  formatClock,
  categoryColor,
  chipColor,
  chipInitial
} from '../lib/format'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DAY_OFFSET = 30

// Card chrome: warm white, soft layered shadow (design system for this page)
const CARD_CLS =
  'rounded-[20px] border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0a0b0d] ' +
  'shadow-[0_1px_2px_rgba(24,24,27,0.04),0_14px_40px_-24px_rgba(24,24,27,0.22)] dark:shadow-none transition-colors'

const RANGE_LABEL: Record<Exclude<RangeDays, 0>, string> = {
  1: 'today',
  7: '7 days',
  30: '30 days',
  90: '90 days'
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function StatsView() {
  const [range, setRange] = useState<RangeDays>(7)
  const [dayOffset, setDayOffset] = useState(0)
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false)
  const isToday = range === 1

  // Today data (sessions for timeline/hourly chart + summary)
  const day = useDayData(dayOffset)
  // Range data (skipped for today; streak always fetched)
  const { data: rangeData, streak, error } = useRangeData(isToday ? 0 : range)
  const dark = useDarkMode()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rangeMenuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setRangeMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [rangeMenuOpen])

  if (error) {
    return <div className="text-rose-500 text-sm">Failed to load analytics: {error}</div>
  }

  const summary = isToday ? day.data?.summary : rangeData?.summary
  const categories = isToday ? day.data?.categories ?? [] : []
  const sessions = isToday ? day.data?.sessions ?? [] : []
  const dayStartMs = day.data?.dayStartMs ?? todayStartMs()
  const navDay = (delta: number) =>
    setDayOffset((o) => Math.min(MAX_DAY_OFFSET, Math.max(0, o + delta)))

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] leading-8 font-extrabold tracking-tight">Focus Analytics</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1.5">
            {isToday
              ? dayOffset === 0
                ? 'Local patterns, session rhythm, and app split.'
                : new Date(dayStartMs).toLocaleDateString([], {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })
              : 'Local patterns, session rhythm, and app split.'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {isToday && (
            <div className="flex items-center gap-1 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] shadow-sm p-1">
              <ArrowBtn dir="left" onClick={() => navDay(1)} disabled={dayOffset >= MAX_DAY_OFFSET} title="Older" />
              <ArrowBtn dir="right" onClick={() => navDay(-1)} disabled={dayOffset === 0} title="Newer" />
            </div>
          )}
          <div className="flex items-center gap-1 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] p-1.5 shadow-[0_1px_2px_rgba(24,24,27,0.05),0_10px_28px_-18px_rgba(24,24,27,0.3)] dark:shadow-none">
            <RangeOption active={isToday} onClick={() => { setRange(1); setDayOffset(0) }} label="Today" />
            <RangeOption active={range === 7} onClick={() => setRange(7)} label="7D" />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setRangeMenuOpen((v) => !v)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] transition-colors flex items-center gap-1.5 ${
                  range === 30 || range === 90
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                Range
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {rangeMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0a0b0d] shadow-xl py-1.5 z-30">
                  <RangeMenuOption label="Last 30 days" active={range === 30} onClick={() => { setRange(30); setRangeMenuOpen(false) }} />
                  <RangeMenuOption label="Last 90 days" active={range === 90} onClick={() => { setRange(90); setRangeMenuOpen(false) }} />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => window.tempoAPI.exportData('csv')}
            title="Export sessions (CSV)"
            className="w-10 h-10 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="M7 10l5-5 5 5" /><path d="M5 21h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main column + donut sidebar */}
      <div className="grid xl:grid-cols-[1fr_272px] gap-5 items-start">
        <div className="min-w-0 space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            <StatCard label="Focus time" value={summary ? formatDuration(summary.focusTimeMs) : '--'} sub={RANGE_LABEL[range as Exclude<RangeDays, 0>]} />
            <StatCard label="Score" value={summary?.score == null ? '--' : String(Math.round(summary.score))} sub={isToday ? 'productivity' : 'avg productivity'} />
            <StatCard label="Sessions" value={summary ? String(summary.sessionCount) : '--'} sub="focus blocks" />
            <StatCard label="Streak" value={String(streak)} sub="days" />
          </div>

          {/* Today: session timeline */}
          {isToday && sessions.length > 0 && (
            <Timeline sessions={sessions} categories={categories} dayStartMs={dayStartMs} />
          )}

          {/* Focused time chart: hourly for today, daily for ranges */}
          <div className={CARD_CLS}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h2 className="text-lg font-bold">Focused Time</h2>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {summary
                  ? isToday
                    ? `${formatDuration(summary.trackedTimeMs)} ${dayOffset === 0 ? 'today' : 'that day'} · hourly`
                    : `${formatDuration(summary.trackedTimeMs)} across ${RANGE_LABEL[range as Exclude<RangeDays, 0>]} · daily`
                  : '—'}
              </span>
            </div>
            <div className="px-6 pb-6">
              {isToday ? (
                <HourlyChart sessions={sessions} dayStartMs={dayStartMs} dark={dark} />
              ) : (
                <DailyChart trend={rangeData?.trend ?? []} days={range as Exclude<RangeDays, 0>} dark={dark} />
              )}
            </div>
          </div>

          {/* Productivity mix */}
          <div className={CARD_CLS}>
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <h2 className="text-lg font-bold">Productivity Mix</h2>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {isToday ? 'categories today' : 'categories in range'}
              </span>
            </div>
            <MixCard sessions={isToday ? sessions : undefined} breakdown={isToday ? undefined : rangeData?.categoryBreakdown} />
          </div>

          {/* Usage breakdown */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-bold">Usage Breakdown</h2>
              <span className="text-xs text-gray-500 dark:text-gray-500">apps and websites</span>
            </div>
            <div className="grid lg:grid-cols-2 gap-5">
              <SplitCard title="App Split" caption="apps · sites excluded" entries={summary?.topApps} />
              <SplitCard title="Browser Activity" caption="visited sites" entries={summary?.topSites} />
            </div>
          </div>
        </div>

        {/* Donut sidebar (stacks below on narrow screens) */}
        <aside className="space-y-4 xl:sticky xl:top-20">
          <DonutCard sessions={isToday ? sessions : undefined} breakdown={isToday ? undefined : rangeData?.categoryBreakdown} />
        </aside>
      </div>
    </div>
  )
}

function todayStartMs(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

// ---------- chart components ----------

function DailyChart({ trend, days, dark }: { trend: { date: string; trackedTimeMs: number }[]; days: number; dark: boolean }) {
  const tk = todayKey()
  const data = trend.map((t) => {
    const d = new Date(`${t.date}T00:00:00`)
    return { label: t.date === tk ? 'T' : d.toLocaleDateString([], { weekday: 'narrow' }), trackedMs: t.trackedTimeMs }
  })
  if (data.length === 0) {
    return <div className="h-56 flex items-center justify-center text-[13px] text-gray-400 dark:text-gray-600">No tracked time in this range yet</div>
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: dark ? '#71717a' : '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
          interval={days > 7 ? 2 : 0}
        />
        <YAxis
          tickFormatter={(v: number) => formatDuration(v * 60000)}
          tick={{ fontSize: 11, fill: dark ? '#71717a' : '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Bar
          dataKey="trackedMs"
          radius={[7, 7, 7, 7]}
          barSize={Math.min(36, Math.max(12, Math.floor(560 / data.length)))}
          fill={dark ? '#e7e5e4' : '#1c1917'}
          cursor="default"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Hourly tracked time for one day, from raw sessions. */
function HourlyChart({ sessions, dayStartMs, dark }: { sessions: Session[]; dayStartMs: number; dark: boolean }) {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const hStart = dayStartMs + h * 3600_000
    const hEnd = hStart + 3600_000
    let ms = 0
    for (const s of sessions) {
      const dur = s.ended_at - s.started_at
      if (dur < 3000) continue
      const overlap = Math.min(hEnd, s.ended_at) - Math.max(hStart, s.started_at)
      if (overlap > 0) ms += overlap
    }
    return { label: `${String(h).padStart(2, '0')}`, trackedMs: ms }
  })
  const hasTime = hours.some((h) => h.trackedMs > 0)
  if (!hasTime) {
    return <div className="h-56 flex items-center justify-center text-[13px] text-gray-400 dark:text-gray-600">No tracked time this day yet</div>
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={hours} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: dark ? '#71717a' : '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
          interval={2}
        />
        <YAxis
          tickFormatter={(v: number) => formatDuration(v * 60000)}
          tick={{ fontSize: 11, fill: dark ? '#71717a' : '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Bar
          dataKey="trackedMs"
          radius={[5, 5, 5, 5]}
          barSize={14}
          fill={dark ? '#e7e5e4' : '#1c1917'}
          cursor="default"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- stat cards ----------

function StatCard({ label, value, sub, children, className = '' }: {
  label: string
  value: string
  sub: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`${CARD_CLS} px-5 py-5 ${className}`}>
      <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400 dark:text-gray-600">{label}</div>
      <div className="text-[26px] leading-8 font-extrabold mt-2 tabular-nums">{value}</div>
      {children}
      <div className={`text-xs text-gray-400 dark:text-gray-600 mt-1 ${children ? '!mt-1.5' : ''}`}>{sub}</div>
    </div>
  )
}

function RangeOption({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-[13px] transition-colors ${
        active
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
  )
}

function RangeMenuOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors ${
        active
          ? 'text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-white/[0.05]'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
      }`}
    >
      {label}
    </button>
  )
}

function ArrowBtn({ dir, onClick, disabled, title }: { dir: 'left' | 'right'; onClick: () => void; disabled: boolean; title: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  )
}

// ---------- productivity mix ----------

function MixCard({ sessions, breakdown }: { sessions?: Session[]; breakdown?: CategorySlice[] }) {
  let productive = 0
  let neutral = 0
  let unproductive = 0

  if (sessions) {
    for (const s of sessions) {
      const dur = s.ended_at - s.started_at
      if (dur < 3000) continue
      // Canonical 3-category model: 10 Productive, 9 Unproductive, else Neutral
      const p = s.category_id === 10 ? 2 : s.category_id === 9 ? -2 : 0
      if (p > 0) productive += dur
      else if (p < 0) unproductive += dur
      else neutral += dur
    }
  } else if (breakdown) {
    for (const slice of breakdown) {
      if (slice.productivity > 0) productive += slice.durationMs
      else if (slice.productivity < 0) unproductive += slice.durationMs
      else neutral += slice.durationMs
    }
  } else {
    return null
  }

  const total = productive + neutral + unproductive
  if (total === 0) {
    return <div className="px-6 pb-6 text-[13px] text-gray-400 dark:text-gray-600">No tracked time yet</div>
  }

  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`
  const seg = (v: number, color: string, label: string) =>
    v === 0 ? null : (
      <div
        className="h-3.5 first:rounded-l-full last:rounded-r-full"
        style={{ width: pct(v), backgroundColor: color }}
        title={`${label}: ${formatDuration(v)} (${pct(v)})`}
      />
    )

  return (
    <div className="px-6 pb-6 pt-2">
      <div className="flex w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.03]">
        {seg(productive, '#10b981', 'Productive')}
        {seg(neutral, '#64748b', 'Neutral')}
        {seg(unproductive, '#f43f5e', 'Unproductive')}
      </div>
      <div className="flex justify-between mt-3 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-500 not-italic" />{formatDuration(productive)} productive</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-slate-500 not-italic" />{formatDuration(neutral)} neutral</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-rose-500 not-italic" />{formatDuration(unproductive)} unproductive</span>
      </div>
    </div>
  )
}

// ---------- timeline (today only) ----------

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function Timeline({ sessions, categories, dayStartMs }: {
  sessions: Session[]
  categories: Category[]
  dayStartMs: number
}) {
  const now = Date.now()
  const nowPct = now >= dayStartMs && now < dayStartMs + DAY_MS ? ((now - dayStartMs) / DAY_MS) * 100 : null
  const gridlines = Array.from({ length: 25 }, (_, h) => h)

  return (
    <div className={`${CARD_CLS} mb-5`}>
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h2 className="text-lg font-bold">Timeline</h2>
        <div className="flex gap-4 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-500 not-italic" />Productive</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-rose-500 not-italic" />Unproductive</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-slate-500 not-italic" />Neutral</span>
        </div>
      </div>
      <div className="px-6 pb-5">
        <div className="relative h-16 rounded-xl overflow-hidden bg-gray-100/80 dark:bg-white/[0.03]">
          {gridlines.map((h) => (
            <div
              key={h}
              className={`absolute top-0 bottom-0 w-px ${h % 3 === 0 ? 'bg-gray-200 dark:bg-white/[0.08]' : 'bg-gray-100 dark:bg-white/[0.04]'}`}
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}
          {sessions.map((s, i) => {
            const left = ((s.started_at - dayStartMs) / DAY_MS) * 100
            const width = Math.max(0.15, ((s.ended_at - s.started_at) / DAY_MS) * 100)
            return (
              <div
                key={i}
                className="absolute top-1.5 h-14 rounded-[4px] opacity-90 hover:opacity-100 transition-opacity"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: categoryColor(s.category_id), zIndex: 10 }}
                title={`${s.app_name}${s.domain ? ` — ${s.domain}` : ''} — ${categories.find((c) => c.id === s.category_id)?.name ?? 'Neutral'}\n${formatClock(s.started_at)} – ${formatClock(s.ended_at)} (${formatDuration(s.ended_at - s.started_at)})`}
              />
            )
          })}
          {nowPct !== null && dayStartMs === todayStartMs() && (
            <div className="absolute top-0 bottom-0 w-px bg-indigo-500 z-20" style={{ left: `${nowPct}%` }} title="now" />
          )}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-gray-400 dark:text-gray-600 tabular-nums">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h}>{hourLabel(h % 24)}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- usage breakdown ----------

/** App/site split rows: chip + name with a category-colored bar + duration/percent. */
function SplitCard({ title, caption, entries }: {
  title: string
  caption: string
  entries: TodaySummary['topApps'] | undefined
}) {
  const list = entries ?? []
  const max = list.reduce((m, e) => Math.max(m, e.durationMs), 1)
  const listTotal = list.reduce((sum, e) => sum + e.durationMs, 0)
  return (
    <div className={CARD_CLS}>
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-500">{caption}</span>
      </div>
      <div className="px-6 pb-5 divide-y divide-gray-100 dark:divide-white/[0.04]">
        {list.length === 0 && (
          <div className="py-8 text-[13px] text-gray-400 dark:text-gray-600">
            No data yet{caption === 'visited sites' ? ' — pair the extension in Settings' : ''}
          </div>
        )}
        {list.map((e) => {
          const pct = listTotal > 0 ? Math.round((e.durationMs / listTotal) * 100) : 0
          const catColor = e.category_id ? categoryColor(e.category_id) : '#64748b'
          return (
            <div key={e.name} className="flex items-center gap-3.5 py-3.5">
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-semibold text-white shrink-0 shadow-sm"
                style={{ backgroundColor: chipColor(e.name) }}
              >
                {chipInitial(e.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{e.name}</div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/[0.05]">
                  <div
                    className="h-full rounded-full min-w-[3px]"
                    style={{ width: `${(e.durationMs / max) * 100}%`, backgroundColor: catColor }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0 w-[86px]">
                <div className="text-sm font-bold tabular-nums">{formatDuration(e.durationMs)}</div>
                <div
                  className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-gray-400 dark:text-gray-600 tabular-nums"
                  title={catName(e.category_id)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                  {pct}%
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function catName(id?: number): string {
  switch (id) {
    case 10: return 'Productive'
    case 9: return 'Unproductive'
    default: return 'Neutral'
  }
}

/** Category donut (Productive / Neutral / Unproductive) + legend with share. */
function DonutCard({ sessions, breakdown }: {
  sessions?: Session[]
  breakdown?: CategorySlice[]
}) {
  let slices: { name: string; durationMs: number; color: string }[] = []

  if (sessions) {
    const byCat = new Map<number, number>()
    for (const s of sessions) {
      const dur = s.ended_at - s.started_at
      if (dur < 3000) continue
      const key = s.category_id ?? 8
      byCat.set(key, (byCat.get(key) ?? 0) + dur)
    }
    slices = [...byCat.entries()].map(([id, durationMs]) => ({
      name: catName(id),
      durationMs,
      color: categoryColor(id)
    }))
  } else if (breakdown) {
    slices = breakdown.map((s) => ({
      name: s.name,
      durationMs: s.durationMs,
      color: categoryColor(s.categoryId)
    }))
  }

  slices.sort((a, b) => b.durationMs - a.durationMs)
  const total = slices.reduce((sum, s) => sum + s.durationMs, 0)

  return (
    <div className={CARD_CLS}>
      <h3 className="text-base font-bold px-6 pt-5 pb-2">Breakdown</h3>
      {total === 0 ? (
        <div className="px-6 pb-6 text-[13px] text-gray-400 dark:text-gray-600">No tracked time yet</div>
      ) : (
        <div className="px-4 pb-5">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="durationMs"
                nameKey="name"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-1">
            {slices.map((d) => (
              <div key={d.name} className="flex items-center gap-2 px-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-gray-600 dark:text-gray-300 flex-1">{d.name}</span>
                <span className="tabular-nums text-gray-400 dark:text-gray-600">{Math.round((d.durationMs / total) * 100)}%</span>
                <span className="tabular-nums font-medium text-gray-700 dark:text-gray-200">{formatDuration(d.durationMs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
