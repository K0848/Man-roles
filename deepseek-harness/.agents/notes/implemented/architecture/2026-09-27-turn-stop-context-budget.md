# Agent Note: Product turn stop checkpoints, context replacement, and finite budgets

Status: implemented

English | [中文](2026-09-27-turn-stop-context-budget.zh.md)

## Problem

The product had a single turn result status and appended shared context injections directly to each persona Session. A cancel request could therefore race a persona switch, withdrawn state could remain in the model-facing surface, and repeated invalid tool feedback had no product-owned request or no-progress limit.

## Decision

Product events now record `turn-execution` separately from the user-visible turn result. The states `running`, `waiting-user`, `stopping`, `stopped`, `stop-failed`, and `unknown` are read by Host and Remote together. Switching rejects while any turn execution is unresolved; cancellation persists `stopping`, requests Agent cancellation, waits for the lease to settle within the configured stop timeout, and records a failed or unknown stop when quiescence is not confirmed.

The Host rebuilds one persona's effective shared context from durable product events before each product step. It writes a fingerprinted `context-projection` and replaces the previous product context messages on the DSH Session surface, retaining raw audit events while preventing withdrawn or superseded context from remaining model-visible. The projection includes the source ids, fingerprint, and encoded model-input byte count used for the step.

Each persona turn owns an explicit finite budget for model requests, tool calls, active time, request timeout, and repeated no-progress fingerprints. The Host observes the existing Agent and tool extension points, cancels the Agent when a limit is reached, and records a `turn-budget` checkpoint with counts and terminal budget status. The default product profile uses eight model requests, twelve tool calls, a 120-second active limit, a 60-second request timeout, and a two-repeat no-progress limit; deployments can provide another finite configuration.

## Alternatives considered

**Treat a cancelled turn as immediately stopped.** This would expose a switch path before DSH `whenIdle()` confirms that the driver and maintenance work have quiesced.

**Keep appending shared context injections.** This would preserve stale state and duplicate the same shared source in later model requests after a withdrawal or update.

**Ask the model to stop through an instruction.** A prompt cannot enforce a request or tool budget when the model, provider, or retry path ignores it, so the Host owns cancellation at runtime extension points.

**Use an unbounded default and rely on deployment discipline.** An omitted limit would make the product's stop and cost behavior undefined, so the profile supplies finite defaults and validates overrides.

## Consequences

The browser can keep a turn in a stopping or unknown state and cannot switch personas until the Host has a durable stopped checkpoint. Session logs remain append-only, while the model-facing surface can be rebuilt from the current allowed set. Product event volume increases for execution and budget checkpoints, and context replacement must continue to preserve DSH tool-pairing rules. Usage and monetary cost remain provider-dependent; this slice records bounded request/tool counts and input bytes, while real quality, latency, and cost still require the later product acceptance batch.

