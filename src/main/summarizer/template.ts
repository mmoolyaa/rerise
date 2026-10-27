import type { DayFacts } from './types'

const MINUTE = 60 * 1000

/** "2h 14m"/"45m"/"<1m" */
export function fmtDuration(ms: number): string {
  const m = Math.round(ms / MINUTE)
  if (m < 1) return '<1m'
  const h = Math.floor(m / 60)
  if (h === 0) return `${m}m`
  const rem = m % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function listNames(entries: { name: string; durationMs: number }[], max: number): string {
  const shown = entries.slice(0, max)
  if (shown.length === 0) return ''
  const parts = shown.map((e) => `${e.name} (${fmtDuration(e.durationMs)})`)
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Renders the day's digest prose from facts. Rules-only engine (no network,
 * no model). One short standalone line per topic, in the same order as the
 * UI cards. The stat cards carry tracked total / focus total / score /
 * switch count, so the prose deliberately never repeats those numbers.
 * Deterministic: the same facts always render the same text.
 */
export function renderDigest(facts: DayFacts): string {
  if (facts.trackedTimeMs <= 0) {
    return `No tracked time — the machine was idle, tracking was paused, or Re:Rise was not running.`
  }

  // ---- opening: overall read + volume ----
  const score = facts.score == null ? null : Math.round(facts.score)
  const stronger = score != null && score >= 70
  const midBand = score != null && score >= 40 && score < 70
  const opener = stronger
    ? 'High-productivity day.'
    : midBand
      ? 'Mixed productivity day.'
      : 'Low-productivity day.'
  const sessionWord = facts.sessionCount === 1 ? 'session' : 'sessions'
  const p1 = `${opener} ${facts.sessionCount} tracked ${sessionWord}.`

  // ---- focus: what the cards cannot show (longest stretch, share of day) ----
  let p2: string
  if (facts.longestFocusMs != null && facts.longestFocusMs > 0) {
    const pct = Math.max(1, Math.round((facts.focusTimeMs / facts.trackedTimeMs) * 100))
    p2 = `Longest qualifying stretch: ${fmtDuration(facts.longestFocusMs)} (focus covered ${pct}% of tracked time).`
  } else {
    p2 = 'No 15-minute window reached 75% productive.'
    if (facts.productiveMs >= 20 * MINUTE) {
      p2 += ` Productive time (${fmtDuration(facts.productiveMs)}) came in bursts too short to chain.`
    }
  }

  // ---- rhythm: span, peak hour, switching pace ----
  const span =
    facts.firstActivityMs != null && facts.lastActivityMs != null
      ? `Active ${fmtClock(facts.firstActivityMs)}–${fmtClock(facts.lastActivityMs)}.`
      : ''
  const busiest =
    facts.busiestHour != null && facts.busiestHourMs > MINUTE
      ? ` Peak hour ${hourLabel(facts.busiestHour)} (${fmtDuration(facts.busiestHourMs)}).`
      : ''
  let paceClause = ''
  if (facts.switchesPerProductiveHour != null) {
    paceClause = ` Switching pace: ~${facts.switchesPerProductiveHour.toFixed(1)} per productive hour.`
  }
  const p3 = [span, busiest, paceClause].filter((x) => x.length > 0).join(' ').replace(/ {2,}/g, ' ')

  // ---- usage: where the time went ----
  const usageSentences: string[] = []
  if (facts.topApps.length > 0) {
    usageSentences.push(`Top apps: ${listNames(facts.topApps, 3)}.`)
  }
  if (facts.topSites.length > 0) {
    usageSentences.push(`Top sites: ${listNames(facts.topSites, 3)}.`)
  }
  const p4 = usageSentences.join(' ')

  // ---- drift: unproductive time and its holders ----
  const p5 =
    facts.unproductiveMs >= 10 * MINUTE && facts.derailers.length > 0
      ? `Unproductive: ${fmtDuration(facts.unproductiveMs)}, mostly on ${listNames(facts.derailers, 2)}.`
      : ''

  return [p1, p2, p3, p4, p5].filter((s) => s.length > 0).join('\n\n')
}
