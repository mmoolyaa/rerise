import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useTodayData } from './hooks/useTodayData'
import TodayView from './components/TodayView'
import RangeView from './components/RangeView'
import SessionsView from './components/SessionsView'
import SettingsView from './components/SettingsView'
import { Segmented } from './components/ui'

type Nav = 'dashboard' | 'sessions' | 'settings'
type RangeTab = 'day' | 'week' | 'month'
type ThemeSetting = 'system' | 'dark' | 'light'

// Local-midnight boundary in ms (local time per spec)
function todayStart(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

export default function App() {
  const [nav, setNav] = useState<Nav>('dashboard')
  const [rangeTab, setRangeTab] = useState<RangeTab>('day')
  const { summary, sessions, categories, state, refresh } = useTodayData()

  // Theme management: apply/remove the Tailwind `dark` class from main-process state
  const [theme, setThemeSetting] = useState<ThemeSetting>('dark')
  useEffect(() => {
    window.tempoAPI
      .getTheme()
      .then((t) => {
        setThemeSetting(t.theme)
        document.documentElement.classList.toggle('dark', t.dark)
      })
      .catch(() => {})
    const unsub = window.tempoAPI.onThemeChanged?.((t) => {
      setThemeSetting(t.theme)
      document.documentElement.classList.toggle('dark', t.dark)
    })
    return () => unsub?.()
  }, [])

  const changeTheme = (next: ThemeSetting) => {
    setThemeSetting(next)
    window.tempoAPI.setTheme(next).catch((err) => console.error('setTheme failed:', err))
  }

  // Bump this to force range/sessions views to refresh
  const [dataVersion, setDataVersion] = useState(0)
  const onMutated = useCallback(() => {
    setDataVersion((v) => v + 1)
    refresh()
  }, [refresh])

  const togglePause = () => {
    if (state === 'PAUSED') window.tempoAPI.resumeTracking()
    else window.tempoAPI.pauseTracking()
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 antialiased transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-gray-200 dark:border-white/[0.06] bg-white/60 dark:bg-[#050505]">
        <div className="flex items-center gap-2.5 px-4 h-16">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-4">Tempo</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">local-only tracker</div>
          </div>
        </div>

        <nav className="px-2 mt-2 space-y-0.5">
          <NavItem active={nav === 'dashboard'} onClick={() => setNav('dashboard')} label="Dashboard" icon={<IconDashboard />} />
          <NavItem active={nav === 'sessions'} onClick={() => setNav('sessions')} label="Sessions" icon={<IconList />} />
          <NavItem active={nav === 'settings'} onClick={() => setNav('settings')} label="Settings" icon={<IconGear />} />
        </nav>

        <div className="mt-auto px-4 py-3 border-t border-gray-200 dark:border-white/[0.05]">
          <StateChip state={state} />
          <button
            onClick={togglePause}
            className="mt-2 w-full text-xs py-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.09] text-gray-600 dark:text-gray-300 transition-colors"
          >
            {state === 'PAUSED' ? 'Resume tracking' : 'Pause tracking'}
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {nav === 'dashboard' && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">
                    {rangeTab === 'day' ? 'Today' : rangeTab === 'week' ? 'Last 7 days' : 'Last 30 days'}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    {rangeTab === 'day'
                      ? new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
                      : 'Productivity overview'}
                  </p>
                </div>
                <Segmented
                  value={rangeTab}
                  onChange={setRangeTab}
                  options={[
                    { value: 'day', label: 'Day' },
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' }
                  ]}
                />
              </div>
              {rangeTab === 'day' && (
                <TodayView summary={summary} sessions={sessions} categories={categories} dayStartMs={todayStart()} />
              )}
              {rangeTab !== 'day' && (
                <RangeView
                  key={`${rangeTab}-${dataVersion}`}
                  days={rangeTab === 'week' ? 7 : 30}
                  fetcher={(d) => window.tempoAPI.getRangeSummary(d)}
                  label={rangeTab}
                />
              )}
            </>
          )}
          {nav === 'sessions' && (
            <>
              <h1 className="text-xl font-semibold tracking-tight mb-5">Sessions</h1>
              <SessionsView key={`sessions-${dataVersion}`} onMutated={onMutated} />
            </>
          )}
          {nav === 'settings' && (
            <>
              <h1 className="text-xl font-semibold tracking-tight mb-5">Settings</h1>
              <SettingsView theme={theme} onThemeChange={changeTheme} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function NavItem({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-gray-100 dark:bg-white/[0.07] text-gray-900 dark:text-white font-medium'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      <span className={active ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}>{icon}</span>
      {label}
    </button>
  )
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

type TrackingState = 'TRACKING' | 'PAUSED' | 'IDLE' | 'LOCKED'

function StateChip({ state }: { state: TrackingState }) {
  const config: Record<TrackingState, { label: string; dot: string }> = {
    TRACKING: { label: 'Tracking', dot: 'bg-emerald-500 animate-pulse' },
    PAUSED: { label: 'Paused', dot: 'bg-amber-500' },
    IDLE: { label: 'Idle', dot: 'bg-gray-400' },
    LOCKED: { label: 'Locked', dot: 'bg-gray-400' }
  }
  const c = config[state]
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  )
}
