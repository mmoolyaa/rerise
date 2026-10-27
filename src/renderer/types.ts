import type { RendererAPI } from '../preload'
import type { TodaySummary } from '../main/scoring/summary'
import type { Session, Category, Rule } from '../main/db/types'
import type { TrackingState } from '../main/tracker/types'
import type { SummaryReply, SessionsReply, RangeSummaryReply, RulesReply, RuleRequest, DayDataReply } from '../main/ipc'
import type { CategorySlice, DayTrend } from '../main/scoring/range'
import type { DigestRow, TodayDigestReply, DayFacts } from '../main/summarizer/types'

export type { TodaySummary, Session, Category, Rule, TrackingState, SummaryReply, SessionsReply, RangeSummaryReply, RulesReply, RuleRequest, DayDataReply, CategorySlice, DayTrend, RendererAPI, DigestRow, TodayDigestReply, DayFacts }

declare global {
  interface Window {
    tempoAPI: RendererAPI
  }
}

export {}
