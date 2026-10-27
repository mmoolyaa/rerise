// Shared types for the day-digest summarizer (main process <-> renderer via IPC)

/** Name + duration entry used in facts (apps, sites, derailers). */
export interface TopName {
  name: string
  durationMs: number
}

/**
 * Everything the template needs to write one day's digest.
 * Built from the same session data the dashboard uses - no extra state.
 */
export interface DayFacts {
  /** Local YYYY-MM-DD */
  day: string
  periodStartMs: number
  periodEndMs: number
  trackedTimeMs: number
  sessionCount: number
  /** Category productivity mapped to 0-100; null with no tracked time */
  score: number | null
  productiveMs: number
  neutralMs: number
  unproductiveMs: number
  focusTimeMs: number
  /** Longest qualifying focus chain; null when nothing qualified */
  longestFocusMs: number | null
  contextSwitches: number
  switchesPerProductiveHour: number | null
  firstActivityMs: number | null
  lastActivityMs: number | null
  /** Local hour (0-23) with the most tracked time; null on empty days */
  busiestHour: number | null
  busiestHourMs: number
  topApps: TopName[]
  topSites: TopName[]
  /** Unproductive (category 9) time holders, worst first */
  derailers: TopName[]
}

/** A stored (finalized) day digest row. Facts are kept so future template
 *  upgrades can re-render old digests without recomputing. */
export interface DigestRow {
  day: string
  createdAt: number
  updatedAt: number
  summaryText: string
  factsJson: string
  isFinal: number
}

export interface TodayDigestReply {
  day: string
  /** Empty string when the day has no tracked data yet */
  text: string
  facts: DayFacts | null
}
