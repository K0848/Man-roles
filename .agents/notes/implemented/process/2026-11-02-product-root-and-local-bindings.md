# Agent Note: Product root and machine-local bindings

Status: implemented

English | [中文](2026-11-02-product-root-and-local-bindings.zh.md)

## Problem

Separate document and source roots require different working directories and duplicate launchers and persona research. A publication directory used as the development root also leaves installed package links and local profiles tied to a nested path. Publishing a local working directory can include task ledgers, private reviews or user data.

## Decision

The repository root owns Git, the pnpm workspace, builds, one launcher and the five authoritative `research/` files. The package graph and dependency lock remain intact. Nested web builds reuse the invoking pnpm entrypoint so a different global version cannot take over the build. `.private/`, `.claude/`, `.validation/` and `.local/` remain local and ignored; delivery uses the reviewed version-control file set. The publication check covers both representative excluded paths and tracked files that contradict ignore rules.

The launcher resolves explicit parameters before `.local/launch.json` and then defaults. Local bindings contain paths and non-secret settings, not credentials. A recipient defaults to `.local/dsh-home` and supplies their own credentials. Existing data stays at its configured location. The CLI's existing profile preparation repairs installation-owned fallback links without rewriting conversations.

`-Update` completes the build before rechecking process identity and stopping a verified instance of this product. Build failure preserves the running service. A different project, changed port owner or reused PID cannot authorize termination. Ordinary launch reuses a verified instance.

## Alternatives considered

**Keep a private wrapper around a publication checkout.** This retains competing development roots, launchers and persona sources; documentation cannot remove their operational ambiguity.

**Deliver the entire local directory.** This includes material outside the product source scope and makes private data exclusion depend on manual file selection.

**Move user history into the source tree.** Rebinding the launcher preserves the existing data location without introducing data migration or changing conversation semantics.

## Consequences

Directory relocation requires updating package-manager metadata, workspace junctions, profile fallback links and current navigation. Ignore rules protect normal Git additions; they do not redact tracked content, prior commits or arbitrary folder uploads. Contributors review file content as well as paths. `scripts/start-man-roles.test.mjs` exercises the real PowerShell entry with isolated process boundaries; source-only installation, builds and empty-data startup remain distinct from real-provider quality acceptance.
