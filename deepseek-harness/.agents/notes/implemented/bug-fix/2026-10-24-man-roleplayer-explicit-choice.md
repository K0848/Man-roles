# Agent Note: Explicit choice answers preserve bounded model work

Status: implemented

English | [中文](2026-10-24-man-roleplayer-explicit-choice.zh.md)

## Problem

An empty choice answer can consume a pending question as though the user explicitly skipped it. Counting the time spent waiting for a human against the persona turn budget can also cancel a valid choice before the user responds.

## Decision

The Host validates every answer before appending any choice or execution event. Each question requires selected options, nonblank custom text, or explicit `skipped: true` without answer content. The skip fact persists through the product projection, tool result, and shared context. The latest choice event determines whether the active turn is waiting; answered choices return the running model to `running`. Built Host and Client codecs are regenerated together when the public answer fields change.

A pending choice pauses the turn's remaining active-time budget. Settlement resumes the same remaining budget, while cancellation and teardown retain their existing stop ownership. Request timeouts remain scoped to model streams, which finish before choice-tool execution.

## Alternatives considered

**Treat an empty answer as a skip.** This prevents the Host from distinguishing accidental submission from an explicit user decision.

**Increase or reset the active budget.** Human response time remains unbounded, while resetting the budget would grant additional model work after every choice.

## Consequences

Loader regressions assert rejected answers leave the event log unchanged, explicit skips reach the model, a choice survives human waiting beyond active and request timeouts, and the turn then completes. Separate Loader regressions retain active/request exhaustion, cancellation, and cold recovery coverage. Browser acceptance is owned by the product integration workflow.
