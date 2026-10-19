import { useEffect, useState, useCallback } from 'react'
import type { Session, Category } from '../types'
import { formatDuration, formatClock, categoryColor, categoryName } from '../lib/format'
import { Card, CardHeader } from './ui'

export default function SessionsView({ onMutated }: { onMutated: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [rulePrompt, setRulePrompt] = useState<{
    kind: 'app' | 'domain'
    pattern: string
    categoryName: string
  } | null>(null)

  const load = useCallback(async () => {
    try {
      const reply = await window.tempoAPI.getSessionsToday()
      setSessions(reply.sessions)
      setCategories(reply.categories)
    } catch (e) {
      console.error('sessions list load failed:', e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus((s) => (s === msg ? null : s)), 6000)
  }

  const recategorize = async (sessionId: number | undefined, categoryId: number | null) => {
    if (!sessionId) return
    setBusy(true)
    try {
      await window.tempoAPI.setSessionCategory(sessionId, categoryId)
      await load()
      onMutated()
    } finally {
      setBusy(false)
    }
  }

  const recategorizeAll = async () => {
    setBusy(true)
    try {
      const res = await window.tempoAPI.recategorizeAll()
      window.alert(`Re-categorized ${res.updated} sessions with the current rules.`)
      await load()
      onMutated()
    } finally {
      setBusy(false)
    }
  }

  /** Opens the category picker for creating a permanent rule for this app/site. */
  const openRulePrompt = (s: Session, kind: 'app' | 'domain') => {
    const pattern = (kind === 'app' ? s.app_name : s.domain)?.trim()
    if (!pattern) return
    setRulePrompt({ kind, pattern, categoryName: kind === 'app' ? s.app_name : s.domain || pattern })
  }

  /**
   * Creates a persistent rule with the user-picked category, then re-applies
   * rules across all history - so the change applies to every past and future
   * session from that app/site.
   */
  const confirmRule = async (categoryId: number) => {
    if (!rulePrompt) return
    setBusy(true)
    try {
      await window.tempoAPI.saveRule({
        match_type: rulePrompt.kind,
        pattern: rulePrompt.pattern,
        category_id: categoryId,
        // Beat default rules: domains default 90, apps default 50
        priority: rulePrompt.kind === 'domain' ? 95 : 55
      })
      const res = await window.tempoAPI.recategorizeAll()
      flash(
        `Rule saved: ${rulePrompt.kind} "${rulePrompt.pattern}" → ${categoryName(categoryId, categories)} (${res.updated} sessions updated)`
      )
      setRulePrompt(null)
      await load()
      onMutated()
    } catch (e) {
      flash(`Failed to save rule: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const ruleChip =
    'text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.09] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-40 transition-colors'

  return (
    <Card>
      <CardHeader
        title={`Today's sessions (${sessions.length})`}
        right={
          <button
            onClick={recategorizeAll}
            disabled={busy}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.09] text-gray-600 dark:text-gray-300 disabled:opacity-50 transition-colors"
          >
            Re-categorize all
          </button>
        }
      />

      {status && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-xs text-indigo-700 dark:text-indigo-300">
          {status}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-500 pb-6 px-4">No sessions today yet.</div>
      )}

      <div className="px-4 pb-3 divide-y divide-gray-100 dark:divide-white/[0.04]">
        {sessions
          .slice()
          .sort((a, b) => b.started_at - a.started_at)
          .map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(s.category_id) }} />
              <span className="w-[70px] text-xs tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                {formatClock(s.started_at)}–{formatClock(s.ended_at)}
              </span>
              <span className="w-[48px] shrink-0 text-xs tabular-nums text-gray-600 dark:text-gray-300">{formatDuration(s.ended_at - s.started_at)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{s.app_name}{s.domain ? ` — ${s.domain}` : ''}</div>
                {s.window_title && (
                  <div className="truncate text-[11px] text-gray-500 dark:text-gray-500">{s.window_title}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openRulePrompt(s, 'app')}
                  disabled={busy}
                  className={ruleChip}
                  title={`Set every session from "${s.app_name}" to a category`}
                >
                  app→rule
                </button>
                {s.domain && (
                  <button
                    onClick={() => openRulePrompt(s, 'domain')}
                    disabled={busy}
                    className={ruleChip}
                    title={`Set every session on "${s.domain}" to a category`}
                  >
                    site→rule
                  </button>
                )}
                <select
                  value={s.category_id ?? 8}
                  disabled={busy}
                  onChange={(e) => recategorize(s.id, Number(e.target.value))}
                  className="text-[11px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
      </div>

      {/* Rule category picker */}
      {rulePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRulePrompt(null)}>
          <div
            className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0a0b0d] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium mb-1">Create rule</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Every session from <b>{rulePrompt.kind === 'app' ? 'app' : 'site'}</b>{' '}
              <code className="text-[11px]">{rulePrompt.pattern}</code> will be set to — past and future.
            </p>
            <div className="flex gap-2 mb-3">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => confirmRule(c.id)}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 dark:border-white/[0.08] text-xs hover:bg-gray-50 dark:hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(c.id) }} />
                  {c.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRulePrompt(null)}
              className="w-full py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.09] text-gray-600 dark:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="px-4 pb-3 text-[11px] text-gray-500 dark:text-gray-500">
        Tip: click <b>app→rule</b> or <b>site→rule</b>, pick a category, and every past + future session from that app/site switches to it.
      </p>
    </Card>
  )
}
