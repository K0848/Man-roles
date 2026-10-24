# Agent Note: Man-roles workspace root

Status: implemented

English | [中文](2026-10-24-man-roles-workspace-root.zh.md)

## Problem

A nested source checkout separates the product's Git entry from its workspace and build entry, obscures product ownership, and makes local dependency links depend on a second directory layout.

## Decision

The repository root owns the pnpm workspace, build configuration, product launchers and research files. The existing package groups retain their relative layout and dependency identities. The three product packages identify the Man-roles repository in their metadata. Upstream attribution remains in [SOURCE.md](../../../../SOURCE.md) and retained licenses.

The root ignore file excludes local credentials, runtime state, private working material and generated outputs. It permits environment templates, source, lockfiles, required regression fixtures and product assets. [The ignore check](../../../../scripts/verify-publish-ignore.mjs) verifies representative excluded and included paths and detects ignored files already in the index. Content review remains necessary because ignore rules do not redact files or Git history.

## Alternatives considered

Keeping a nested source copy preserves the original checkout layout but requires separate build navigation and ongoing synchronization. Moving individual business packages outside the workspace would also require dependency and compiler changes unrelated to the repository entry problem. A single workspace root preserves package relationships without either cost.

## Consequences

Install, build, test and commit from the same root. The public launcher resolves persona assets within this repository and stores new runtime state under the ignored `.local/` directory. No existing user data is moved. Package renaming and dependency upgrades are outside this layout change.

## Testing

Verify file preservation during relocation, package metadata, bilingual entry documentation, ignore behavior against the final index, the standard build, focused product regressions and an empty-profile browser launch with five persona cards. No live model request is required for the layout check.
