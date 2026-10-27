/**
 * Summary view — day digests, presented as data cards.
 *
 * Today is a live DRAFT (recomputed on load, finalized nightly at local
 * midnight); past days are stored digests with re-render/copy affordances.
 * Prose comes from a local deterministic template engine.
 */
import { useCallback, useEffect, useState } from 'react'
import { formatDuration } from '../lib/format'
import type { DayFacts, DigestRow } from '../../main/summarizer/types'

const CARD_CLS =
  'rounded-[20px] border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0a0b0d] ' +
  'shadow-[0_1px_2px_rgba(24,24,27,0.04),0_14px_40px_-24px_rgba(24,24,27,0.22)] dark:shadow-none'

function parseFacts(json: string | null): DayFacts | null {
  if (!json) return null
  try {
    return JSON.parse(json) as DayFacts
  } catch {
    return null
  }
}

function scoreTone(score: number | null): string {
  if (score == null) return 'text-gray-400 dark:text-gray-600'
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-500'
  return 'text-rose-600 dark:text-rose-400'
}

/** Headline numbers of a day, laid out like the Stats page's stat cards. */
function StatRow({ facts }: { facts: DayFacts | null }) {
  if (!facts || facts.trackedTimeMs <= 0) return null
  const cells = [
    { value: formatDuration(facts.trackedTimeMs), label: 'Tracked' },
    { value: formatDuration(facts.focusTimeMs), label: 'Focus time' },
    {
      value: facts.score == null ? '--' : String(Math.round(facts.score)),
      label: 'Score',
      tone: scoreTone(facts.score)
    },
    { value: String(facts.contextSwitches), label: 'Switches' }
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-gray-100 dark:border-white/[0.05] bg-gray-50/80 dark:bg-white/[0.03] px-4 py-3"
        >
          <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-400 dark:text-gray-600">{c.label}</div>
          <div className={`text-[22px] leading-7 font-extrabold mt-1 tabular-nums ${c.tone ?? ''}`}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function SummaryView() {
  const [dead, setDead] = useState(false)
  const [draftFacts, setDraftFacts] = useState<DayFacts | null>(null)
  const [draftText, setDraftText] = useState('')
  const [digests, setDigests] = useState<DigestRow[]>([])
  const [regenDay, setRegenDay] = useState<string | null>(null)
  const [copiedDay, setCopiedDay] = useState<string | null>(null)
  const [tick, refreshTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const [d, rows] = await Promise.all([window.tempoAPI.getTodayDigest(), window.tempoAPI.getDigests()])
      setDraftText(d.text)
      setDraftFacts(d.facts)
      setDigests(rows.digests)
    } catch {
      setDead(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, tick])

  const regenerate = async (day: string) => {
    setRegenDay(day)
    try {
      await window.tempoAPI.regenerateDigest(day)
      await load()
    } finally {
      setRegenDay(null)
    }
  }

  const copy = async (day: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedDay(day)
      setTimeout(() => setCopiedDay(null), 1500)
    } catch {
      /* clipboard unavailable - ignore */
    }
  }

  if (dead) {
    return <div className="text-rose-500 text-sm">Failed to load digests.</div>
  }

  return (
    <div className="space-y-5">
      {/* Today: live draft */}
      <div className={`${CARD_CLS} px-8 py-7`}>
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold">Today</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200/60 dark:border-amber-500/20">
              draft · finalized nightly
            </span>
          </div>
          <button
            onClick={() => refreshTick((v) => v + 1)}
            title="Recompute from current data"
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-5">
          <StatRow facts={draftFacts} />
          {draftFacts && draftText && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(draftFacts.periodStartMs).toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
          <DigestProse text={draftText} emptyToday />
        </div>
      </div>

      {/* Past digests */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-bold">Digest history</h2>
          {digests.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-500">{digests.length} days</span>
          )}
        </div>
        {digests.length === 0 ? (
          <div className={`${CARD_CLS} px-6 py-8 text-[13px] text-gray-400 dark:text-gray-600`}>
            No finalized digests yet — the first one lands after local midnight. Past tracked days backfill automatically on the next launch.
          </div>
        ) : (
          <div className="space-y-4">
            {digests.map((row) => (
              <div key={row.day} className={CARD_CLS}>
                <div className="flex items-center justify-between gap-3 px-8 pt-5 pb-4">
                  <h3 className="text-base font-bold">{row.day}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => copy(row.day, row.summaryText)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      {copiedDay === row.day ? 'Copied ✓' : 'Copy'}
                    </button>
                    <button
                      onClick={() => regenerate(row.day)}
                      disabled={regenDay === row.day}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                    >
                      {regenDay === row.day ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  </div>
                </div>
                <div className="px-8 pb-6 space-y-5">
                  <StatRow facts={parseFacts(row.factsJson)} />
                  <DigestProse text={row.summaryText} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DigestProse({ text, emptyToday = false }: { text: string; emptyToday?: boolean }) {
  if (!text) {
    return (
      <p className="text-[13px] text-gray-400 dark:text-gray-600">
        {emptyToday ? 'Nothing tracked yet today.' : '(no text)'}
      </p>
    )
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
      {text.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}
