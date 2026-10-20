import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#0a0b0d] dark:shadow-none transition-colors ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
      <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{title}</h3>
      {right}
    </div>
  )
}

export function Stat({
  label,
  value,
  accent = ''
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2.5">
      <div className="text-[11px] text-gray-500 dark:text-gray-500">{label}</div>
      <div className={`text-[15px] font-semibold mt-0.5 tabular-nums ${accent}`}>{value}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-white/[0.04] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            value === o.value
              ? 'bg-white dark:bg-[#15161a] dark:text-gray-100 shadow-sm text-gray-900 font-medium'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
