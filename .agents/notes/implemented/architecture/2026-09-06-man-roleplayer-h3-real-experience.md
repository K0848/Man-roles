# Agent Note: man-roleplayer H3 real-experience safeguards

Status: implemented

English | [中文](2026-09-06-man-roleplayer-h3-real-experience.zh.md)

## Decision

The evidence lookup tool declares a string topic and integer requestedCount with a documented 1–3 bound, while runtime validation remains the final gate. A turn that received usable evidence must cite at least one returned evidence id before its structured answer can be accepted.

The product records non-sensitive thinking activity facts around each turn and projects only the allow-listed phase, timing, persona, and operation references. Running activity belongs to its question; terminal activity folds into its accepted answer and reports cumulative distinct evidence. Raw reasoning remains owned by the persona Session rather than product events. The Host derives it through the exact product attempt, delivery, persona branch, Session user message, and enclosing DSH turn, then projects only text, persona, product turn, and status. The UI keeps reasoning collapsed by default, retains cancelled/failed prefixes, and creates no row when the provider emitted none.

State analysis persists both the Host authority projection and the alias-redacted projection actually sent to the model. The model sees the JSON Schema derived from the same Zod contract used by the Host, may reference only the supplied short aliases, and does not choose the target turn. Initial analysis, retry, and claimed recovery deduplicate authority events before rebuilding aliases. Automatic titles accept one plain-text candidate; explanatory alternatives or Markdown are removed, and invalid output falls back to the first user message.

## Boundaries

The product keeps accepted-only answers, persona/session isolation, evidence ownership, and ordinary DSH separation unchanged. Invalid lookup arguments produce a bounded failure and do not create a successful evidence claim. Fenced parsing and model-visible JSON Schema do not relax the Host's strict schema, alias, source, current-turn, or lifecycle validation. Per-turn identity guidance does not change persisted preset composition identity.

## Verification

The affected-scope Loader suite passed 55/55, the man-roleplayer client suite passed 17/17, the system-Chrome H3 suite passed 3/3, Host/Client/Web builds passed, and `git diff --check` passed. Tests include the real dirty-title sample, pending-plus-delivered duplicate user facts, legacy duplicate retry input, multi-turn current-turn selection, evidence-citation gating, cumulative distinct evidence, durable acknowledgement, activity placement, live elapsed time, terminal recovery, settled-plus-streaming multi-step reasoning, retry-attempt separation, default folding, failed-prefix recovery, no fabricated reasoning, and wire exclusion of Session/tool/prompt identity.

The fixed 3085 profile was also exercised with `deepseek-official / deepseek-v4-flash`. The identity question completed in 167 seconds with a Wang Yangming identity/help response, an accepted evidence citation, and four cumulative distinct evidence items. Its legacy failed state-analysis input was deduplicated from three facts to two; after the model received the complete JSON Schema, retry completed without replaying the persona answer. A fresh `你好` probe completed in 45 seconds with one cited evidence item, a two-fact model projection, a completed state snapshot, and a plain `你好` title fallback. The five-question value study, comparative persona review, and unit-success cost decision remain outside this implementation gate.
