# Agent Note: State analysis preserves explicit user corrections

Status: implemented

English | [中文](2026-10-23-man-roleplayer-state-correction.zh.md)

## Problem

A corrected shared fact and its original user message can disagree. State extraction from the untouched original message can recreate the old wording under a new model-generated item id. Historical confirmed versions and repeated extraction can also duplicate a fact or omit the user's current correction from the persona snapshot input.

## Decision

The analysis input includes each allowed confirmed state item only at its latest durable version. A source containing exact text spans represented by state history is marked partially processed and carries an array of independent remaining original fragments instead of a fabricated complete message. Fragment boundaries remain intact; the model is instructed not to join them or infer that the user omitted information from their incomplete appearance. The current confirmed replacement remains visible as shared state; rejected, withdrawn, and superseded text cannot acquire automatic confirmation merely by reusing its historical user source.

Candidate admission compares kind, normalized text, and intersecting event-source lineage. State references resolve to their original sources so changing a model candidate id or citing an existing state item does not create a new fact. The same rule applies to candidates in one result. New user-message ids remain independent sources, including when a user explicitly reasserts earlier wording. When a new source reuses an existing model item id, the Host scopes its persisted id to the analysis operation instead of overwriting a user-owned version.

Automatic confirmation checks one continuous original fragment of the effective model input rather than the original unfiltered message or joined fragments. Model inferences remain candidates. Historical events remain intact; the transformation affects analysis input and admission only.

## Alternatives considered

Globally blocking all historically seen text prevents users from explicitly changing or reasserting facts in later messages. Source lineage distinguishes those new statements from repeated extraction.

Similarity scores would introduce an ungrounded semantic threshold and risk merging conflicting facts. Exact normalized wording and durable source relationships provide deterministic duplicate handling. Semantically different inferences retain the existing user-confirmation requirement.

## Consequences

Current user decisions take precedence in both the state-analysis request and its published snapshot. The Host does not invent semantic field identities or migrate historical user data. Residual fragments can include punctuation and incomplete clauses; their explicit partial-source label prevents presenting them as a complete user statement. Unrelated continuous statements remain available for extraction.

Loader regressions exercise production analysis requests, public modification/rejection/withdrawal operations, duplicate and obsolete model proposals, snapshot input, and later explicit user statements. Real-provider wording remains subject to model behavior; Host admission never promotes unverifiable rewritten text to confirmed state.
