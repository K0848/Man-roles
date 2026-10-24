# Agent Note: Variable persona branches with durable allocation and recovery

Status: implemented

English | [中文](2026-09-23-variable-persona-branch-lifecycle.zh.md)

## Problem

The product roster contains more personas than any one dilemma needs, while the old product event and service paths required exactly two branches. That prevented a dilemma from starting with one persona, adding another after a completed turn, recovering a partially created Session, or deleting all participating histories after a crash.

## Decision

New `created` events contain a nonempty array of distinct persona branches. A new Remote request may explicitly select one or more personas; omitting the field remains the legacy Wang Yangming/Zeng Guofan create behavior for old callers. The client starts with one selected persona, and `switchPersona` allocates a missing branch only when it is selected.

Branch allocation is durable and idempotent. The Host appends `branch-allocation` with a stable operation id and preallocated Session id, creates or resumes the specified Session, verifies its preset identity, then appends `branch-added` before publishing `persona-switched`. A failed association records the same allocation as failed; a retry reuses its Session id and operation id instead of creating another branch. On restart, claimed allocations are reconciled from the persisted Session id and identity; unknown or missing Sessions remain failed and do not become an active branch by guesswork.

Deletion captures all published branches and any claimed but unpublished allocations as immutable targets. It persists a generic `deleting-branch` checkpoint and completed Session ids, accepts the historical `deleting-wang`, `deleting-zeng`, `deleting-first-branch`, and `deleting-second-branch` stages while reading old events, and resumes remaining targets with the same operation id. A missing Session is treated as already absent only when the persistence layer reports the explicit not-found result. Product facts are removed only after every target is accounted for.

The Remote projection exposes only persona ids in a variable-length `branches` array. The client renders existing branches and offers unjoined roster personas as add actions; it does not expose raw Session ids or infer identity from array positions.

## Alternatives considered

**Create the full roster for every dilemma.** This would create unused Sessions, increase model and storage cost, and make the first user action create work the user did not request.

**Keep two branches in the product event and store new branches outside the event stream.** This would create a second source of truth and make restart, deletion, and Remote projection disagree about participation.

**Allocate a new Session on every retry.** This would leave orphan Sessions after a crash or association failure and could expose duplicate persona histories after recovery.

**Delete only published branches.** This would leave a claimed but unpublished Session behind after an interrupted first join, so deletion targets include both published and claimed branches.

## Consequences

Existing two-branch events remain readable and their historical deletion stages remain recoverable. New dilemmas can grow from one to multiple branches without changing the roster authority. The allocation claim adds durable event volume and requires a Session identity check during restart, but it prevents duplicate side effects and makes partial failure observable. The Host configuration still needs at least two available persona bindings for a useful roster; that configuration rule is separate from the number of branches persisted by one dilemma.

