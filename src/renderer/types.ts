import type { RendererAPI } from '../preload'
import type { TodaySummary } from '../main/scoring/summary'
import type { Session, Category, Rule } from '../main/db/types'
import type { TrackingState } from '../main/tracker/types'
import type { SummaryReply, SessionsReply, RangeSummaryReply, RulesReply, RuleRequest, DayDataReply } from '../main/ipc'

export type { TodaySummary, Session, Category, Rule, TrackingState, SummaryReply, SessionsReply, RangeSummaryReply, RulesReply, RuleRequest, DayDataReply, RendererAPI }

declare global {
  interface Window {
    tempoAPI: RendererAPI
  }
}

export {}
