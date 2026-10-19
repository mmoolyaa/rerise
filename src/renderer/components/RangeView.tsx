import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import type { RangeSummaryReply } from '../typesPhase6'
import { formatDuration, categoryColor } from '../lib/format'
import { Card, CardHeader, Stat } from './ui'

function RangeView({ days, fetcher, label }: { days: number; fetcher: (d: number) => Promise<RangeSummaryReply>; label: string }) {
  const [data, setData] = useState<RangeSummaryReply | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetcher(days)
        if (!cancelled) {
          setData(res)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    const interval = setInterval(load, 120_000)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', load)
    }
  }, [days, fetcher])

  if (error) {
    return <div className="text-rose-500 text-sm">Failed to load {label}: {error}</div>
  }

  if (!data) {
    return <div className="text-gray-500 dark:text-gray-500 text-sm py-8">Loading {label}…</div>
  }

  const chartData = data.trend.map((t) => ({
    ...t,
    // Recharts handles nulls poorly on lines; substitute 50 (neutral midpoint)
    lineScore: t.score ?? 50,
    tracked: formatDuration(t.trackedTimeMs)
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Avg score" value={data.summary.score === null ? '--' : String(Math.round(data.summary.score))} />
        <Stat label="Tracked" value={formatDuration(data.summary.trackedTimeMs)} />
        <Stat label="Focus" value={formatDuration(data.summary.focusTimeMs)} />
      </div>

      <Card>
        <CardHeader title="Daily score trend" />
        <div className="px-4 pb-3">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickFormatter={(d: string) => d.slice(5)}
                interval={days > 14 ? 3 : 0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={((v: number, name: unknown) =>
                  name === 'lineScore' ? [v, 'score'] : [v, String(name)]) as never}
                contentStyle={{
                  background: '#131820',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  fontSize: 12
                }}
              />
              <Line dataKey="lineScore" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-500 dark:text-gray-600 -mt-1">
            Days with no tracked time are plotted at the neutral midpoint (50).
          </p>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Category breakdown" />
          {data.categoryBreakdown.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-500 px-4 pb-4">No tracked time in this range.</div>
          ) : (
            <div className="pb-3">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    dataKey="durationMs"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.categoryBreakdown.map((s) => (
                      <Cell key={s.categoryId} fill={categoryColor(s.categoryId)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={((v: number) => formatDuration(v)) as never}
                    contentStyle={{
                      background: '#131820',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 px-4 text-xs">
                {data.categoryBreakdown.map((s) => (
                  <div key={s.categoryId} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(s.categoryId) }} />
                    <span className="text-gray-600 dark:text-gray-300 flex-1">{s.name}</span>
                    <span className="tabular-nums text-gray-500 dark:text-gray-400 shrink-0">{formatDuration(s.durationMs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Top apps" />
            <TopMini items={data.summary.topApps} />
          </Card>
          <Card>
            <CardHeader title="Top sites" />
            <TopMini items={data.summary.topSites} />
          </Card>
        </div>
      </div>
    </div>
  )
}

function TopMini({ items }: { items: { name: string; durationMs: number }[] }) {
  if (items.length === 0) return <div className="text-xs text-gray-500 dark:text-gray-500 px-4 pb-4 py-2">No data</div>
  return (
    <div className="space-y-2 px-4 pb-4">
      {items.slice(0, 5).map((e) => (
        <div key={e.name} className="flex justify-between gap-2 text-xs">
          <span className="truncate text-gray-700 dark:text-gray-200">{e.name}</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400 shrink-0">{formatDuration(e.durationMs)}</span>
        </div>
      ))}
    </div>
  )
}

export default RangeView
