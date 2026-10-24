# Agent Note: Client choice submission requires complete answers or explicit skip

Status: implemented

English | [中文](2026-10-24-choice-validation-client.zh.md)

## Problem

The browser could send an empty answer when the user pressed submit, and single-select questions could submit immediately while later questions remained unanswered. The pending card then disappeared, making an incomplete response look accepted.

## Decision

The client keeps option and custom-text drafts under the Host choice operation id. Single-select and multi-select changes update only that draft. For a single-select question, choosing custom text clears the radio selection; returning to the radio answer mode retains the typed text in the local draft but omits it from the request. Multi-select questions continue to submit selected options together with non-blank custom text. Normal submission sends the full question set only when each question has at least one selected option or non-blank custom text; whitespace-only custom text is omitted and does not satisfy validation. The dedicated skip action sends `skipped: true` for every question with no answer content. Submission is guarded against duplicate activation, and failed attempts leave the card available for retry.

When the selected Host projection reports a pending choice or a waiting-choice active turn, the header and details say that the user is expected to choose. The matching live activity is replaced by a waiting message so the turn is not presented as actively thinking or accruing client-visible generation time.

## Alternatives considered

**Submit each single-select change immediately.** This can close a multi-question card before the user answers the remaining questions and bypasses custom-text validation.

**Treat an empty answer as an implicit skip.** An accidental submit would become indistinguishable from an intentional decision to skip. The explicit skip action preserves that distinction in the Host request.

## Consequences

Incomplete answers stay editable and visible until the user completes every question or explicitly skips. Option and custom-text drafts are scoped to one Host operation, so a different choice cannot inherit them. The client duplicates the completeness rule for immediate feedback; the Host remains authoritative and rejects invalid wire answers. Browser-component tests cover empty and whitespace-only answers, valid option/custom answers, explicit skip markers, duplicate-submit locking, and the waiting-choice presentation.
