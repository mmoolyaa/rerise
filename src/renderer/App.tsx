import { useState, useCallback, useEffect, type ReactNode } from 'react'
import StatsView from './components/StatsView'
import SessionsView from './components/SessionsView'
import SettingsView from './components/SettingsView'
import { useTodayData } from './hooks/useTodayData'

type Nav = 'stats' | 'sessions' | 'settings'
type ThemeSetting = 'system' | 'dark' | 'light'

function effectiveDark(next: ThemeSetting): boolean {
  if (next === 'dark') return true
  if (next === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

function applyThemeClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

export default function App() {
  const [nav, setNav] = useState<Nav>('stats')
  // Tracker state + pause only
  const { state, refresh: refreshState } = useTodayData()

  const [dataVersion, setDataVersion] = useState(0)
  const onMutated = useCallback(() => {
    setDataVersion((v) => v + 1)
    refreshState()
  }, [refreshState])

  // Theme management: apply/remove the Tailwind `dark` class from main-process state.
  // Applied optimistically on selection so the UI always reacts immediately.
  const [theme, setThemeSetting] = useState<ThemeSetting>('light')
  useEffect(() => {
    window.tempoAPI
      .getTheme()
      .then((t) => {
        setThemeSetting(t.theme)
        applyThemeClass(t.dark)
      })
      .catch((err) => console.error('getTheme failed:', err))
    const unsub = window.tempoAPI.onThemeChanged?.((t) => {
      setThemeSetting(t.theme)
      applyThemeClass(t.dark)
    })
    return () => unsub?.()
  }, [])

  const changeTheme = (next: ThemeSetting) => {
    setThemeSetting(next)
    applyThemeClass(effectiveDark(next))
    window.tempoAPI.setTheme(next).catch((err) => console.error('setTheme failed:', err))
  }

  const togglePause = () => {
    if (state === 'PAUSED') window.tempoAPI.resumeTracking()
    else window.tempoAPI.pauseTracking()
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-black text-gray-900 dark:text-gray-100 antialiased transition-colors duration-200">
      {/* Floating pill navigation */}
      <header className="fixed top-4 inset-x-0 z-40 flex justify-center pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <nav className="flex items-center gap-0.5 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] shadow-sm px-1.5 py-1.5">
            <PillItem active={nav === 'stats'} onClick={() => setNav('stats')} label="Stats" icon={<IconStats />} />
            <PillItem active={nav === 'sessions'} onClick={() => setNav('sessions')} label="Sessions" icon={<IconList />} />
            <PillItem active={nav === 'settings'} onClick={() => setNav('settings')} label="Settings" icon={<IconSliders />} />
          </nav>
          <button
            onClick={togglePause}
            title={state === 'PAUSED' ? 'Resume tracking' : 'Pause tracking'}
            className="flex items-center gap-1.5 rounded-full bg-white dark:bg-[#0a0b0d] border border-gray-200/70 dark:border-white/[0.07] shadow-sm pl-2.5 pr-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              state === 'TRACKING' ? 'bg-emerald-500 animate-pulse' : state === 'PAUSED' ? 'bg-amber-500' : 'bg-gray-400'
            }`} />
            <span className={`text-[11px] ${state === 'PAUSED' ? 'text-amber-600 dark:text-amber-500' : 'text-gray-500 dark:text-gray-400'}`}>
              {state === 'PAUSED' ? 'Paused' : 'Tracking'}
            </span>
            {state === 'PAUSED' ? <IconPlay /> : <IconPause />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20">
        <div className="mx-auto max-w-6xl px-8 pb-16">
          {nav === 'stats' && <StatsView key={`stats-${dataVersion}`} />}
          {nav === 'sessions' && (
            <>
              <h1 className="text-2xl font-bold tracking-tight mb-1">Sessions</h1>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-5">Today's tracked activity, rule by rule.</p>
              <SessionsView key={`sessions-${dataVersion}`} onMutated={onMutated} />
            </>
          )}
          {nav === 'settings' && (
            <>
              <h1 className="text-2xl font-bold tracking-tight mb-1">Settings</h1>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-5">Rules, privacy, and appearance.</p>
              <SettingsView theme={theme} onThemeChange={changeTheme} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function PillItem({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] transition-colors ${
        active
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      <span className={active ? '' : 'opacity-70'}>{icon}</span>
      {label}
    </button>
  )
}

function IconStats() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" strokeWidth="2" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M2 14h4M10 8h4M18 16h4" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="currentColor">
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-emerald-500" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

type TrackingState = 'TRACKING' | 'PAUSED' | 'IDLE' | 'LOCKED'
