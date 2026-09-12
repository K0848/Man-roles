import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { manRolesProbeRequestSchema, manRolesProbeResponseSchema } from '../lib/product-types.js'
import { manRolesRemoteContribution } from '../lib/client-remote-probe.js'

test('Host Product Remote exposes strict manRolesProbe.ping contract', () => {
  const hostSource = readFileSync(new URL('../src/product/remote-probe.ts', import.meta.url), 'utf8')
  assert.match(hostSource, /extends TypertRemoteService/)
  assert.match(hostSource, /@Remote\('ping'\)/)
  assert.match(readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8'), /plugin\(ManRolesProbeService\)/)
  const request = manRolesProbeRequestSchema.parse({ nonce: 'compat-check' })
  const response = manRolesProbeResponseSchema.parse({ ok: true, nonce: request.nonce, service: 'manRolesProbe' })
  assert.deepEqual(response, { ok: true, nonce: 'compat-check', service: 'manRolesProbe' })
  assert.throws(() => manRolesProbeRequestSchema.parse({ nonce: 42 }), /expected string/i)
  assert.throws(() => manRolesProbeRequestSchema.parse({ nonce: 'x', extra: true }), /unrecognized key/i)
  assert.throws(() => manRolesProbeResponseSchema.parse({ ok: false, nonce: 'x', service: 'manRolesProbe' }), /expected true/i)
  assert.throws(() => manRolesProbeResponseSchema.parse({ ok: true, nonce: 'x', service: 'other' }), /expected .*manRolesProbe/i)
})

test('Client assembly mounts and disposes the plugin Remote contribution', async () => {
  const calls = []
  const disposer = async () => { calls.push('disposed') }
  const ctx = { remote: { $mount: async (contribution) => { calls.push(['mounted', contribution.package]); return disposer } } }
  const { mountManRolesRemote } = await import('../lib/client-remote-probe.js')
  const dispose = await mountManRolesRemote(ctx)
  assert.deepEqual(calls, [['mounted', 'man-roles-roleplayer']])
  await dispose()
  assert.deepEqual(calls, [['mounted', 'man-roles-roleplayer'], 'disposed'])
  assert.equal(manRolesRemoteContribution.descriptors[0].id, 'manRolesProbe/ping')
  assert.deepEqual(manRolesRemoteContribution.descriptors.slice(1).map((descriptor) => descriptor.id), ['manRolesProduct/create', 'manRolesProduct/view', 'manRolesProduct/switchPersona', 'manRolesProduct/send', 'manRolesProduct/feedback'])
  const feedbackCodec = manRolesRemoteContribution.descriptors.find((descriptor) => descriptor.id === 'manRolesProduct/feedback').parameters[0].codec.schema
  assert.deepEqual(feedbackCodec.parse({ conversationId: 'c', itemId: 'candidate', action: 'correct', operationId: 'op', replacement: '纠正后的困惑' }), { conversationId: 'c', itemId: 'candidate', action: 'correct', operationId: 'op', replacement: '纠正后的困惑' })
  assert.throws(() => feedbackCodec.parse({ conversationId: 'c', itemId: 'candidate', action: 'correct', operationId: 'op', extra: true }), /unexpected extra/)
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.exports['./remote'].default, './lib/client-remote-probe.js')
})

test('Remote compatibility remains plugin-owned and does not touch DSH Core surfaces', () => {
  assert.equal(manRolesRemoteContribution.package, 'man-roles-roleplayer')
})
