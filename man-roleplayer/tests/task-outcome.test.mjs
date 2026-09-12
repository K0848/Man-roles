const registry = makePersonaRegistry(mkdtempSync(join(tmpdir(), 'shared-personas-')))
import { makePersonaRegistry } from './persona-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TrunkStorage } from '../lib/storage.js'
import { projectTaskOutcome, TASK_BUDGET_BLOCKED_MESSAGE } from '../lib/task-outcome.js'
const outcome = { taskId: 'task-1', personaId: 'alpha', branchSessionId: 'branch-1', branchTurn: 2, status: 'blocked', reason: 'budget_exceeded', retryable: true }
test('task budget blocked outcome is idempotent and replays', () => { const dir = mkdtempSync(join(tmpdir(), 'task-outcome-')); const s = TrunkStorage.create('c', dir, 'alpha', registry); assert.notEqual(s.recordTaskBudgetBlocked(outcome), -1); assert.equal(s.recordTaskBudgetBlocked(outcome), -1); assert.deepEqual(s.state.taskOutcomes['task-1'], outcome); const restored = TrunkStorage.load('c', dir, registry); assert.deepEqual(restored.state.taskOutcomes['task-1'], outcome); assert.deepEqual(projectTaskOutcome(outcome), { status: 'blocked', message: TASK_BUDGET_BLOCKED_MESSAGE, retryable: true }) })
test('conflicting same task outcome fails instead of overwriting', () => { const dir = mkdtempSync(join(tmpdir(), 'task-outcome-conflict-')); const s = TrunkStorage.create('c', dir, 'alpha', registry); s.recordTaskBudgetBlocked(outcome); assert.throws(() => s.recordTaskBudgetBlocked({ ...outcome, branchTurn: 3 })) })
test('invalid outcome fails before persistence boundary', () => { const dir = mkdtempSync(join(tmpdir(), 'task-outcome-invalid-')); const s = TrunkStorage.create('c', dir, 'alpha', registry); const before = readFileSync(s.filePath, 'utf8'); const seq = s.nextSeq; assert.throws(() => s.recordTaskBudgetBlocked({ ...outcome, taskId: '', branchTurn: 0 })); assert.equal(readFileSync(s.filePath, 'utf8'), before); assert.equal(s.nextSeq, seq); assert.deepEqual(s.state.taskOutcomes, {}) })
test('different task ids remain independent and do not alter user raws or dilemma state', () => { const dir = mkdtempSync(join(tmpdir(), 'task-outcome-independent-')); const s = TrunkStorage.create('c', dir, 'alpha', registry); s.recordTaskBudgetBlocked(outcome); s.recordTaskBudgetBlocked({ ...outcome, taskId: 'task-2', branchTurn: 3 }); assert.deepEqual(Object.keys(s.state.taskOutcomes).sort(), ['task-1', 'task-2']); assert.deepEqual(s.state.userRaws, []); assert.equal(s.state.dilemma.phase, 'pending') })
