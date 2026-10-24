# Agent Note: Recoverable man-roleplayer context test fixtures

Status: implemented

English | [中文](2026-09-22-man-roleplayer-context-recovery-harness.zh.md)

## Problem

A context-replacement test cannot establish restart safety by reconstructing a Session from an in-memory event array. Product events and Session history have separate owners, and opening the product repository does not automatically resume persona agents in a library composition without default agent options. Treating an absent live agent as missing durable data confuses activation with storage recovery.

## Decision

The [T0 Loader fixture](../../../../packages/extensions/man-roleplayer/tests/t0-loader-support.ts) owns an isolated temporary JSONL root and product-storage medium for each test. Reopening retains those media while replacing the Loader and backend instances. Tests explicitly resume the persisted dilemma through the product service before driving its recovered agent. Final cleanup releases the Loader before removing the owned directory and medium.

The [context candidate](../../../../packages/extensions/man-roleplayer/tests/t0-context-candidate.ts) separates calculation from application and uses the same projection path before model requests and at recovery checkpoints. Projection reuse is determined from persisted content and source metadata; an in-memory generation counter cannot establish replay equivalence. Summary dependencies refer to durable state identities and immutable user-message identities; missing or stale dependencies invalidate the summary. The [tests](../../../../packages/extensions/man-roleplayer/tests/t0-context-harness.spec.ts) observe requests, product events and Session events together.

## Alternatives considered

**In-memory Session replay alone.** It exercises event projection but skips Loader activation, JSONL reads and product-to-Session bindings, so it cannot establish the required recovery behavior.

**Changing production startup to satisfy the fixture.** The product already distinguishes repository opening from agent activation. The test owns explicit activation; changing application defaults would expand the behavior under test.

**A shared global test medium.** It makes one test's cleanup affect another test's recovery. Each temporary root instead owns its medium, retained only across that test's Loader instances.

## Consequences

The fixtures exercise both sides of the state-commit/projection-commit interval and check that replay does not add an equivalent replacement or an extra model request. Product storage uses the existing test backend across Loader instances, while Session history uses real JSONL files. This does not prove operating-system process-kill durability for a production database, provider cache savings, or production integration of the context candidate.
