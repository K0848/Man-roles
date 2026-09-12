import type { ContentLibraries } from '../retrieval/retrieve.ts'
import type { ActorReplySegment } from './types.ts'

export function renderVerifiedReply(segments: ActorReplySegment[], libs: ContentLibraries, questions: string[] = []): string {
  return segments.map((s) => {
    if (s.kind === 'modern_inference') return `【今译/推演】${s.text}`
    if (s.kind === 'modern_external_fact') return `【现代外部事实】${s.text}〔来源：${(s.evidenceIds ?? []).join('、')}〕`
    if (s.kind === 'historical_fact') {
      const facts = (s.evidenceIds ?? []).map((id) => libs.anecdotes.byId(id)).filter((x): x is NonNullable<typeof x> => Boolean(x))
      return facts.map((fact) => `【史实依据】${fact.title}：${fact.summary}〔出处：${fact.source}〕`).join('\n')
    }
    if (s.kind === 'verbatim_quote' || s.kind === 'thought_attribution') {
      const quotes = (s.evidenceIds ?? []).map((id) => libs.quotes.byId(id)).filter((x): x is NonNullable<typeof x> => Boolean(x))
      const sources = (s.evidenceIds ?? []).map((id) => libs.quotes.byId(id)?.source ?? libs.anecdotes.byId(id)?.source).filter((x): x is string => Boolean(x))
      // 逐字引文的正文必须回读权威库；模型提交的 segment.text 只参与
      // 校验，不得成为公开输出，避免把伪造文本与真实出处绑定展示。
      const [quote] = quotes
      const text = s.kind === 'verbatim_quote' && quotes.length === 1 && quote !== undefined ? quote.text : s.text
      return sources.length ? `${text}〔出处：${[...new Set(sources)].join('；')}〕` : text
    }
    return s.text
  }).concat(questions.map((q) => q.trim()).filter(Boolean)).join('\n')
}
