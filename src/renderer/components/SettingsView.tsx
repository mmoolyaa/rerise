import { useEffect, useState, useCallback } from 'react'
import type { Rule, Category, RuleRequest } from '../typesPhase6'
import { Segmented } from './ui'

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
function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const reply = await window.tempoAPI.getRules()
    setRules(reply.rules)
    setCategories(reply.categories)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await window.tempoAPI.deleteRule(id)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`

  return (
    <div className="space-y-4">
      <RuleEditor categories={categories} onSaved={load} />

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <th className="py-1 pr-2">Priority</th>
            <th className="py-1 pr-2">Type</th>
            <th className="py-1 pr-2">Pattern</th>
            <th className="py-1 pr-2">Category</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1.5 pr-2 font-mono text-xs">{r.priority}</td>
              <td className="py-1.5 pr-2 text-xs">{r.match_type}</td>
              <td className="py-1.5 pr-2 font-mono text-xs truncate max-w-[220px]">{r.pattern}</td>
              <td className="py-1.5 pr-2 text-xs">{catName(r.category_id)}</td>
              <td className="py-1.5 text-right">
                <button
                  onClick={() => remove(r.id)}
                  disabled={busy}
                  className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50"
                  title="Delete rule"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-500">
                No rules - add one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">Higher priority numbers are matched first. Rules overwrite: change priority, save, then re-categorize past sessions from the Sessions tab.</p>
    </div>
  )
}

function RuleEditor({ categories, onSaved }: { categories: Category[]; onSaved: () => void }) {
  const [matchType, setMatchType] = useState<RuleRequest['match_type']>('domain')
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 8)
  const [priority, setPriority] = useState(90)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id)
    }
  }, [categories, categoryId])

  const save = async () => {
    setError(null)
    try {
      await window.tempoAPI.saveRule({ match_type: matchType, pattern, category_id: categoryId, priority })
      setPattern('')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
      <div className="text-sm font-medium mb-2">Add rule</div>
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as RuleRequest['match_type'])}
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200"
        >
          <option value="domain">domain</option>
          <option value="app">app</option>
          <option value="title_regex">title_regex</option>
        </select>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={matchType === 'title_regex' ? 'regex e.g. vscode' : 'e.g. example.com or Code.exe'}
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200 flex-1 min-w-[220px]"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={priority}
          min={0}
          max={1000}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-200 w-[70px]"
          title="Priority (0-1000)"
        />
        <button
          onClick={save}
          disabled={!pattern.trim()}
          className="text-xs px-3 py-1.5 rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
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
        <p className="text-xs text-gray-500">System follows your OS preference. Default: dark.</p>
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
