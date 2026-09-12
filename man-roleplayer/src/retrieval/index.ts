/**
 * man-roles-roleplayer —— retrieval 层统一出口（纯 TS，零 DSH 运行时依赖）。
 *
 * 阶段 6 入口：事迹库/语录索引/黑名单 + 确定性检索 + 围栏化 + 出处校验 + 工具。
 * lib/retrieval.js 由本文件打包（data.ts 内联 content/*.json），单元测试直接 import。
 */
export { AnecdoteStore, queryTerms, scoreAnecdote } from './anecdote-store.ts'
export type { Anecdote, SearchOptions } from './anecdote-store.ts'
export { QuoteStore } from './quote-store.ts'
export type { Quote, QuoteCredibility } from './quote-store.ts'
export { Blacklist, normalizeText } from './blacklist.ts'
export type { BlacklistEntry, BlacklistEntryKind, BlacklistMode } from './blacklist.ts'
export {
  retrieveAnecdotes,
  fetchAnecdote,
  fetchQuote,
  fetchSource,
  normalizeSource,
  sourceMatches,
} from './retrieve.ts'
export type { ContentLibraries, RetrievedAnecdote } from './retrieve.ts'
export {
  verifyCitation,
  checkBlacklist,
  verifyReference,
  extractCitedSources,
} from './verify.ts'
export type { CitationViolation, CitationViolationCode, VerifyResult } from './verify.ts'
export {
  RETRIEVE_ANECDOTES_TOOL,
  FETCH_ANECDOTE_TOOL,
  RETRIEVE_QUOTES_TOOL,
  FETCH_QUOTE_TOOL,
  EVIDENCE_ACTOR_TOOLS,
  ACTOR_TOOLS,
  makeRetrieveHandler,
  makeFetchHandler,
  makeActorHandlers,
  runActorTurnWithRetrieval,
} from './tools.ts'
export type { ActorTurnResult } from './tools.ts'
export {
  CONTENT_VERSION,
  ANECDOTES,
  QUOTES,
  BLACKLIST_ENTRIES,
  ANECDOTE_COUNTS,
  QUOTE_COUNTS,
  BLACKLIST_COUNTS,
  buildContentLibraries,
  contentLibrariesFromArtifact,
  assertContentIntegrity,
} from './data.ts'
