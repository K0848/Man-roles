# Agent Note: H2.6.1 product lifecycle operations

Status: implemented

English | [中文](2026-09-05-man-roleplayer-h261-title-choice-lifecycle.zh.md)

## Problem

The product browser surface needed lifecycle operations without exposing ordinary DSH session/question identities. Automatic title generation also raced with user rename and could not prove user ownership across recovery.

## Decision

The product Remote owns active-only rename, discussion pause/resume/stage-end, opaque structured-choice operations, and failed-turn retry. Choice facts are persisted in the product event stream and the Agent-scope adapter resolves or cancels one waiter; cold recovery closes a pending waiter as failed without replaying the persona turn. Rename increments a title revision and marks the title user-owned. Title claims capture that revision, and late success/fallback results settle as stale or suppressed without changing the title or invoking the Provider again.

## Verification

Focused product, repository, client-store, and Loader-composition tests pass (72 tests); the package and client TypeScript projects pass with `--noEmit`. Existing accepted-only projection and ordinary DSH paths remain covered by their prior suites.

## Consequences

The wire projection includes only title ownership metadata and product operation handles. A user answer remains a user expression until an explicit state action; raw Session ids and tool-call ids stay private.
