import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { TodaySummary } from '../types'
import { useRangeData, type RangeDays } from '../hooks/useRangeData'
import { useDarkMode } from '../hooks/useDarkMode'
import { formatDuration, chipColor, chipInitial } from '../lib/format'

const ACCENT = '#c4714b'

type DayLabel = { date: string; label: string; trackedMs: number }

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dayLabels(trend: { date: string; trackedTimeMs: number }[]): DayLabel[] {
  const tk = todayKey()
  return trend.map((t) => {
    const d = new Date(`${t.date}T00:00:00`)
    return { date: t.date, label: t.date === tk ? 'T' : d.toLocaleDateString([], { weekday: 'narrow' }), trackedMs: t.trackedTimeMs }
  })
}

const RANGE_LABEL: Record<RangeDays, string> = { 1: 'today', 7: '7 days', 30: '30 days', 90: '90 days' }

export default function StatsView() {
  const [range, setRange] = useState<RangeDays>(7)
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false)
  const { data, streak, error } = useRangeData(range)
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

  const summary = data?.summary
  const trend = data?.trend ?? []

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Focus Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Local patterns, session rhythm, and app split.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] p-1 shadow-sm">
            <RangeOption active={range === 1} onClick={() => setRange(1)} label="Today" />
            <RangeOption active={range === 7} onClick={() => setRange(7)} label="7D" />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setRangeMenuOpen((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors flex items-center gap-1 ${
                  range === 30 || range === 90
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                Range
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {rangeMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0a0b0d] shadow-lg py-1 z-30">
                  <RangeMenuOption label="Last 30 days" active={range === 30} onClick={() => { setRange(30); setRangeMenuOpen(false) }} />
                  <RangeMenuOption label="Last 90 days" active={range === 90} onClick={() => { setRange(90); setRangeMenuOpen(false) }} />
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => window.tempoAPI.exportData('csv')}
            title="Export sessions (CSV)"
            className="w-9 h-9 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path d="M7 10l5-5 5 5" /><path d="M5 21h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Focus time" value={summary ? formatDuration(summary.focusTimeMs) : '--'} sub={RANGE_LABEL[range]} />
        <StatCard label="Sessions" value={summary ? String(summary.sessionCount) : '--'} sub="focus blocks" />
        <StatCard label="Streak" value={streak > 0 ? String(streak) : '0'} sub="days" />
        <StatCard label="Top activity" value="" sub="tracked apps">
          <div className="mt-1.5 flex items-center gap-1.5 min-h-[28px]">
            {(summary?.topApps ?? []).slice(0, 4).map((a) => (
              <span
                key={a.name}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                style={{ backgroundColor: chipColor(a.name) }}
                title={a.name}
              >
                {chipInitial(a.name)}
              </span>
            ))}
            {(summary?.topApps ?? []).length === 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-600 font-normal">No data yet</span>
            )}
          </div>
        </StatCard>
      </div>

      {/* Focused time */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0a0b0d] shadow-sm transition-colors mb-8">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-base font-bold">Focused Time</h2>
          <span className="text-[11px] text-gray-500 dark:text-gray-500">
            {summary ? `${formatDuration(summary.trackedTimeMs)} across ${RANGE_LABEL[range]} · daily` : '—'}
          </span>
        </div>
        <div className="px-5 pb-5">
          {trend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-400 dark:text-gray-600">No tracked time in this range yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dayLabels(trend)} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: dark ? '#71717a' : '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                  interval={range > 7 ? 2 : 0}
                />
                <YAxis
                  tickFormatter={(v: number) => formatDuration(v * 60000)}
                  tick={{ fontSize: 10, fill: dark ? '#71717a' : '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Bar
                  dataKey="trackedMs"
                  radius={[6, 6, 6, 6]}
                  barSize={Math.min(34, Math.max(10, Math.floor(560 / trend.length)))}
                  fill={dark ? '#e7e5e4' : '#1c1917'}
                  cursor="default"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Usage breakdown */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold">Usage Breakdown</h2>
        <span className="text-[11px] text-gray-500 dark:text-gray-500">apps and websites</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <SplitCard title="App Split" caption="tracked apps" entries={summary?.topApps} />
        <SplitCard title="Browser Activity" caption="visited sites" entries={summary?.topSites} />
      </div>
    </div>
  )
}

function RangeOption({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
        active
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium'
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
      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
        active
          ? 'text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-white/[0.05]'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
      }`}
    >
      {label}
    </button>
  )
}

function StatCard({ label, value, sub, children }: { label: string; value: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0a0b0d] shadow-sm px-4 py-4 transition-colors">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">{label}</div>
      <div className="text-xl font-bold mt-1.5 tabular-nums">{value}</div>
      {children}
      <div className={`text-[11px] text-gray-400 dark:text-gray-600 mt-1 ${children ? 'mt-0' : ''}`}>{sub}</div>
    </div>
  )
}

/** App/site split rows: chip + name with a thin accent bar + duration/percent. */
function SplitCard({ title, caption, entries }: {
  title: string
  caption: string
  entries: TodaySummary['topApps'] | undefined
}) {
  const list = entries ?? []
  const max = list.reduce((m, e) => Math.max(m, e.durationMs), 1)
  const listTotal = list.reduce((sum, e) => sum + e.durationMs, 0)
  return (
    <div className="rounded-2xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0a0b0d] shadow-sm transition-colors">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="text-base font-bold">{title}</h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-500">{caption}</span>
      </div>
      <div className="px-5 pb-4 divide-y divide-gray-100 dark:divide-white/[0.04]">
        {list.length === 0 && (
          <div className="py-6 text-xs text-gray-400 dark:text-gray-600">
            No data yet{caption === 'visited sites' ? ' — pair the extension in Settings' : ''}
          </div>
        )}
        {list.map((e) => {
          const pct = listTotal > 0 ? Math.round((e.durationMs / listTotal) * 100) : 0
          return (
            <div key={e.name} className="flex items-center gap-3 py-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ backgroundColor: chipColor(e.name) }}
              >
                {chipInitial(e.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{e.name}</div>
                <div className="mt-1 h-1 w-full rounded-full bg-gray-100 dark:bg-white/[0.05]">
                  <div
                    className="h-full rounded-full min-w-[3px]"
                    style={{ width: `${(e.durationMs / max) * 100}%`, backgroundColor: ACCENT }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold tabular-nums">{formatDuration(e.durationMs)}</div>
                <div className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums">{pct}%</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
