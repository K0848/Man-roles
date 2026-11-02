# `@deepseek-ai/dsh-man-roleplayer-app`

English | [中文](README.zh.md)

This is the independent product profile overlay for `@deepseek-ai/dsh-man-roleplayer`. Compose it with `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app` in a separate profile. The overlay disables the generic sidebar, composer, conversation, and tool UI, then mounts the product client as the sole root surface. The ordinary `web` and `headless` profiles are unchanged.

Host configuration is explicit. Set `DSH_MAN_ROLEPLAYER_PRESET_ROOT` and `DSH_MAN_ROLEPLAYER_PERSONAS_JSON`; the latter is a registry-derived array of `{ id, researchPath, presetId }` bindings for the enabled audited personas. Missing, duplicate, or invalid bindings fail closed; no current-working-directory or network fallback exists. `DSH_MAN_ROLEPLAYER_PROVIDER` and `DSH_MAN_ROLEPLAYER_MODEL` are required deployment references; test harnesses may bind `mock` explicitly. The profile also applies finite per-turn model-request, tool-call, active-time, request-timeout, and no-progress limits.

The browser receives only opaque dilemma handles and the redacted product projection. It creates one dilemma with the selected first persona, adds later branches through the versioned product Remote, and renders only accepted structured persona answers. Raw Session ids, internal tool names, and internal errors are not user-facing values.

## Model Experience

### Composed persona execution

#### What the model sees

This overlay contributes no prompt or tool text directly. Persona presets, evidence tools, titles and state-analysis prompts belong to [man-roleplayer](../../extensions/man-roleplayer/README.md). The overlay sets `stateAnalysis: true` and configures execution budgets for persona turns.

#### Token effect

The overlay adds no tokens directly. The composed product plugins consume requests and tokens for persona conversations, titles and state analysis; persona requests have an 8,192-token output cap.

#### KV Cache effect

The overlay controls neither cache keys nor cache reuse; effects depend on the composed plugins' prompts and provider behavior.

## Known Limitations and Deferred Work

- This is not a standalone runtime; it requires base, web-app, the selected provider and persona deployment bindings.
- Request, tool-call and time budgets can stop a turn before an answer is accepted; enabling state analysis does not guarantee a valid state result.
