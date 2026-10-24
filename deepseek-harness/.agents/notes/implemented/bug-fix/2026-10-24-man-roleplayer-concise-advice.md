# Agent Note: Concise advice has no fixed minimum length

Status: implemented

English | [中文](2026-10-24-man-roleplayer-concise-advice.zh.md)

## Problem

A fictional classroom exercise requests one opening within thirty characters. The persona submitted an opening, but Host rejected it twice because advice required eighty characters. The model then appended advice and an unwanted historical example to pass admission. Length measured padding rather than whether the requested output was useful.

## Decision

Advice submission has no fixed minimum character count. The Host retains identity checks, nonempty segmented text, validation-filler rejection, modern-inference guidance, topic overlap, and all evidence constraints. The [per-turn communication policy](2026-10-24-man-roleplayer-turn-communication.md) guides requested brevity; Host does not parse arbitrary natural-language length limits.

## Alternatives considered

**Keep eighty characters except for parsed limits.** Parsing unrestricted requests creates another incomplete intent classifier and leaves listening or compact formats in conflict with a numeric floor.

**Remove all quality checks.** The observed defect is caused by length. Removing unrelated protections would admit uncited history, filler, and off-topic answers without addressing another reproduced failure.

## Consequences

A Loader regression with synthetic classroom text admits a concise relevant opening. The same execution rejects bare historical content without guidance, unrelated advice, and validation filler; existing evidence and identity regressions remain applicable. Topic overlap and Claim categories are structural admission checks, not precise semantic quality judgments. Real model review remains necessary for usefulness and compliance with requested length.
