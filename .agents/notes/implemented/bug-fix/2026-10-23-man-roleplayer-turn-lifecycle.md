# Agent Note: Persona turn generation and stop waits have separate lifetimes

Status: implemented

English | [中文](2026-10-23-man-roleplayer-turn-lifecycle.zh.md)

## Problem

Persona generation can legitimately take longer than the configured stop deadline. Applying that deadline to normal Agent idle waits releases the submission lease while generation continues. A later submission then has no live lease, and an acknowledged background turn can reject an unobserved completion promise and terminate the process.

## Decision

The product Host owns one stop signal per executing persona attempt. Every product cancellation and budget limit signals that owner before cancelling the Agent. Normal generation and the optional submission finalizer await idle under the existing active-turn and request budgets; the bounded stop wait begins only after the stop signal. A stopped attempt cannot start a finalizer.

A stop timeout publishes its execution checkpoint but retains the Agent submission lease and message operation until eventual idle records `stopped`. New submissions and retries remain excluded during that interval. Acknowledged attempts attach a rejection observer to their completion promise without changing the promise returned to callers that await completion.

Cold resume verifies the resumed Agent for the same Session is idle before marking a failed turn's unresolved execution checkpoint stopped. Failed turns from an earlier process can then be retried without replaying any model request during recovery.

## Alternatives considered

**Increase the stop timeout.** Generation still has an unrelated deadline and can outlive its lease. The existing generation budgets already own that limit.

**Swallow process-level promise failures.** Global suppression hides unrelated defects and does not prevent overlapping attempts or lost submissions. The observer belongs to the owned background completion promise.

## Consequences

Slow valid answers retain their submission authority. Cancellation remains bounded for callers, while a provider that delays abort keeps the conversation occupied until actual quiescence. Loader-composition regressions cover slow generation and finalization, active/request timeout, acknowledged execution rejection, retry, and delayed cancellation recovery. Real-provider and browser acceptance remain separate integration evidence; these regressions use deterministic external-provider substitutes.
