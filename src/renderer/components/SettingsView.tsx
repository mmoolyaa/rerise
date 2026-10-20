import { useEffect, useState, useCallback } from 'react'
import type { Rule, Category, RuleRequest } from '../typesPhase6'
import { categoryColor } from '../lib/format'
import { Segmented, Card, CardHeader } from './ui'

type Tab = 'rules' | 'general' | 'data'
type ThemeSetting = 'system' | 'dark' | 'light'

export default function SettingsView({
  theme,
  onThemeChange
}: {
  theme?: ThemeSetting
  onThemeChange?: (t: ThemeSetting) => void
}) {
  const [tab, setTab] = useState<Tab>('rules')
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'rules', label: 'Rules' },
          { value: 'general', label: 'General' },
          { value: 'data', label: 'Data' }
        ]}
      />
      {tab === 'rules' && <RulesTab />}
      {tab === 'general' && <GeneralTab />}
      {tab === 'data' && <DataTab />}
    </div>
  )
}

// ---------- Rules ----------
// Auto-priority so users never think about it (advanced override available):
// domains must beat other domain rules (defaults 90), apps must beat defaults (50).
const AUTO_PRIORITY: Record<RuleRequest['match_type'], number> = {
  domain: 95,
  app: 55,
  title_regex: 90
}

function RulesTab({ onMutated }: { onMutated?: () => void }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    const reply = await window.tempoAPI.getRules()
    setRules(reply.rules)
    setCategories(reply.categories)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus((s) => (s === msg ? null : s)), 6000)
  }

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await window.tempoAPI.deleteRule(id)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const applyToHistory = async () => {
    setBusy(true)
    try {
      const res = await window.tempoAPI.recategorizeAll()
      flash(`History re-matched: ${res.updated} sessions updated.`)
      onMutated?.()
    } catch (e) {
      flash(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const cat = (id: number) => categories.find((c) => c.id === id)
  const GROUPS: { type: RuleRequest['match_type']; when: string }[] = [
    { type: 'app', when: 'When the active app is' },
    { type: 'domain', when: 'When the site is' },
    { type: 'title_regex', when: 'When the window title matches' }
  ]
  const inputCls =
    'text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200'

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="text-sm font-medium mb-2">Add a rule</div>
        <RuleEditor categories={categories} onSaved={load} />
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-2">
          A rule permanently links an app, site or title pattern to a category — saving an identical rule again just updates it.
        </p>
      </Card>

      {status && (
        <div className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-xs text-indigo-700 dark:text-indigo-300">
          {status}
        </div>
      )}

      <Card>
        <CardHeader
          title="Your rules"
          right={
            <button
              onClick={applyToHistory}
              disabled={busy}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.09] text-gray-600 dark:text-gray-300 disabled:opacity-50 transition-colors"
              title="Re-run the current rules over all stored sessions"
            >
              Apply rules to history
            </button>
          }
        />
        <div className="px-4 pb-4 space-y-4">
          {rules.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-500 py-2">No rules yet — add one above or from the Sessions view.</div>
          )}
          {GROUPS.map((g) => {
            const group = rules.filter((r) => r.match_type === g.type)
            if (group.length === 0) return null
            return (
              <div key={g.type}>
                <div className="text-[11px] text-gray-400 dark:text-gray-600 mb-1">{g.when}…</div>
                <div className="space-y-1">
                  {group.map((r) => {
                    const c = cat(r.category_id)
                    return (
                      <div key={r.id} className="flex items-center gap-2 text-[13px]">
                        <code className={`${inputCls} font-mono text-[11px] max-w-[260px] truncate`}>{r.pattern}</code>
                        <span className="text-gray-400 dark:text-gray-600">→</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(r.category_id) }} />
                          {c?.name ?? `#${r.category_id}`}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">p:{r.priority}</span>
                        <button
                          onClick={() => remove(r.id)}
                          disabled={busy}
                          className="ml-auto w-6 h-6 rounded-md flex items-center justify-center bg-gray-100 dark:bg-white/[0.05] hover:bg-rose-100 dark:hover:bg-rose-500/20 text-gray-500 hover:text-rose-600 disabled:opacity-40 transition-colors"
                          title="Delete rule"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p className="px-4 pb-3 text-[11px] text-gray-500 dark:text-gray-500">
          Higher priority numbers are matched first. Saved rules apply to <b>new</b> sessions immediately; use{" "}
          <b>Apply rules to history</b> to re-match past sessions.
        </p>
      </Card>
    </div>
  )
}

function RuleEditor({ categories, onSaved }: { categories: Category[]; onSaved: () => void }) {
  const [matchType, setMatchType] = useState<RuleRequest['match_type']>('domain')
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 8)
  const [priority, setPriority] = useState<number>(AUTO_PRIORITY.domain)
  const [error, setError] = useState<string | null>(null)
  const inputCls =
    'text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200'

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id)
    }
  }, [categories, categoryId])

  const changeType = (t: RuleRequest['match_type']) => {
    setMatchType(t)
    setPriority(AUTO_PRIORITY[t])
  }

  const save = async () => {
    setError(null)
    try {
      const res = await window.tempoAPI.saveRule({ match_type: matchType, pattern, category_id: categoryId, priority })
      setPattern('')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const catChip = (c: Category) => {
    const active = categoryId === c.id
    return (
      <button
        key={c.id}
        onClick={() => setCategoryId(c.id)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
          active
            ? 'border-gray-400 dark:border-white/25 bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white font-medium'
            : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(c.id) }} />
        {c.name}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={matchType}
          onChange={(e) => changeType(e.target.value as RuleRequest['match_type'])}
          className={`${inputCls} shrink-0`}
        >
          <option value="app">app equals</option>
          <option value="domain">site equals</option>
          <option value="title_regex">title matches</option>
        </select>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={matchType === 'title_regex' ? 'regex e.g. vscode' : matchType === 'app' ? 'e.g. Code.exe' : 'e.g. example.com'}
          className={`${inputCls} flex-1 min-w-[220px]`}
        />
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1.5">
          {categories.map((c) => catChip(c))}
        </div>
        <button
          onClick={save}
          disabled={!pattern.trim()}
          className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          Save rule
        </button>
      </div>
      <details className="text-[11px] text-gray-500 dark:text-gray-500">
        <summary className="cursor-pointer select-none">Advanced (priority)</summary>
        <div className="flex items-center gap-2 mt-1.5">
          <input
            type="number"
            value={priority}
            min={0}
            max={1000}
            onChange={(e) => setPriority(Number(e.target.value))}
            className={`${inputCls} w-[70px]`}
            title="Priority (0-1000)"
          />
          <span>higher = matched first (auto: {AUTO_PRIORITY[matchType]})</span>
        </div>
      </details>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  )
}

// ---------- General ----------
function GeneralTab({ theme, onThemeChange }: { theme?: ThemeSetting; onThemeChange?: (t: ThemeSetting) => void }) {
  const [idle, setIdle] = useState(120)
  const [autoStart, setAutoStartState] = useState(false)
  const [excludedApps, setExcludedAppsText] = useState('')
  const [excludedDomains, setExcludedDomainsText] = useState('')
  const [storeTitles, setStoreTitles] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.tempoAPI.getGeneralSettings().then((s) => {
      setIdle(s.idleThresholdSeconds)
      setExcludedAppsText(s.excludedApps.join(', '))
      setExcludedDomainsText(s.excludedDomains.join(', '))
      setStoreTitles(s.storeTitles)
    })
    window.tempoAPI.getAutoStart().then(setAutoStartState).catch(() => {})
  }, [])

  const save = async () => {
    await window.tempoAPI.setIdleThreshold(idle)
    await window.tempoAPI.setExcluded(
      excludedApps.split(',').map((s) => s.trim()).filter(Boolean),
      excludedDomains.split(',').map((s) => s.trim()).filter(Boolean)
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5 text-sm max-w-lg">
      <div>
        <label className="block font-medium mb-1">Appearance</label>
        <Segmented
          value={theme ?? 'dark'}
          onChange={(v) => onThemeChange?.(v)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' }
          ]}
        />
        <p className="text-xs text-gray-500">System follows your OS preference. Default: light.</p>
      </div>

      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={autoStart}
          onChange={async (e) => {
            setAutoStartState(e.target.checked)
            await window.tempoAPI.setAutoStart(e.target.checked)
          }}
        />
        Start with Windows (launch at login and keep tracking)
      </label>

      <div>
        <label className="block font-medium mb-1">Idle threshold ({idle}s)</label>
        <input
          type="range"
          min={60}
          max={600}
          step={30}
          value={idle}
          onChange={(e) => setIdle(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-gray-500">Sessions close when no input for this long.</p>
      </div>

      <div>
        <label className="block font-medium mb-1">Excluded apps (never recorded)</label>
        <input
          value={excludedApps}
          onChange={(e) => setExcludedAppsText(e.target.value)}
          placeholder="e.g. 1Password, authy.exe"
          className="w-full text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200"
        />
        <p className="text-xs text-gray-500">Comma-separated. Matches app names loosely (with or without .exe).</p>
      </div>

      <div>
        <label className="block font-medium mb-1">Excluded domains (never recorded)</label>
        <input
          value={excludedDomains}
          onChange={(e) => setExcludedDomainsText(e.target.value)}
          placeholder="e.g. banking.example.com, corp.internal"
          className="w-full text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200"
        />
        <p className="text-xs text-gray-500">Exact domain matches, comma-separated.</p>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={storeTitles}
          onChange={async (e) => {
            setStoreTitles(e.target.checked)
            await window.tempoAPI.setStoreTitles(e.target.checked)
          }}
        />
        Store window titles (local only)
      </label>

      <PairingBox />

      <div className="flex items-center gap-3">
        <button onClick={save} className="px-3 py-1.5 rounded bg-indigo-500 text-white text-xs hover:bg-indigo-600">
          Save settings
        </button>
        {saved && <span className="text-xs text-green-500">Saved</span>}
      </div>
    </div>
  )
}

function PairingBox() {
  const [pairing, setPairing] = useState<{ token: string; port: number } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    window.tempoAPI.getExtensionPairing().then(setPairing)
  }, [])

  if (!pairing) return null
  return (
    <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
      <div className="font-medium mb-1">Extension pairing</div>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs break-all flex-1 min-w-0">{pairing.token}</code>
        <button
          onClick={() =>
            navigator.clipboard.writeText(pairing.token).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }
          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span className="text-xs text-gray-500">port {pairing.port || 47321}</span>
      </div>
    </div>
  )
}

// ---------- Data ----------
function DataTab() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const doExport = async (format: 'csv' | 'json') => {
    setBusy(true)
    try {
      const res = await window.tempoAPI.exportData(format)
      setStatus(res.savedPath ? `Saved to ${res.savedPath}` : 'Export canceled')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await window.tempoAPI.deleteAllData()
      setStatus('All data deleted. Rules reset to defaults.')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 text-sm max-w-lg">
      <div>
        <div className="font-medium mb-2">Export sessions (last 90 days)</div>
        <div className="flex gap-2">
          <button onClick={() => doExport('csv')} disabled={busy} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-xs disabled:opacity-50">
            Export CSV
          </button>
          <button onClick={() => doExport('json')} disabled={busy} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-xs disabled:opacity-50">
            Export JSON
          </button>
        </div>
      </div>

      <div className="border border-red-300 dark:border-red-800 rounded-lg p-3">
        <div className="font-medium text-red-600 dark:text-red-400 mb-1">Delete all data</div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Removes every session and resets rules to defaults. Cannot be undone.
        </p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-xs px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-600">
            Delete all data…
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-red-500">Are you sure?</span>
            <button onClick={doDelete} disabled={busy} className="text-xs px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50">
              Yes, delete everything
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700">
              Cancel
            </button>
          </div>
        )}
      </div>

      {status && <div className="text-xs text-gray-500">{status}</div>}
    </div>
  )
}
