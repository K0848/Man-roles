import { describe, expect, it } from 'vitest'
import { parseResearchEvidence, validateClaimSidecar } from '../src/evidence.ts'

describe('research evidence gate', () => {
  it('keeps only explicitly reliable complete cards', () => {
    const markdown = [
      '> persona_id：`王阳明`',
      '### 【事迹卡 1】',
      '- **title**：可靠事迹',
      '- **full_text**：原始材料',
      '- **source**：《可靠史料》✅',
      '### 【事迹卡 2】',
      '- **title**：待核事迹',
      '- **summary**：待核材料',
      '- **source**：《待核史料》⚠️',
      '### 【事迹卡 3】',
      '- **title**：缺来源',
      '- **full_text**：没有出处',
    ].join('\n')
    expect(parseResearchEvidence(markdown, 'wang-yangming').filter(item => item.trust === 'reliable')).toEqual([{
      id: 'wang-yangming:research:1', persona: 'wang-yangming', title: '可靠事迹', text: '原始材料', source: '《可靠史料》', evidenceType: 'historical-fact', trust: 'reliable', firstPersonAllowed: true,
    }])
  })
  it('rejects overlapping, gapped, unknown, and incorrectly sourced claims', () => {
    const evidence = new Set(['e1'])
    expect(validateClaimSidecar('abcdef', [{ textRange: { start: 0, end: 3 }, kind: 'reliable-quote', evidenceIds: ['e1'] }, { textRange: { start: 3, end: 6 }, kind: 'modern-inference', evidenceIds: [] }], evidence)).toBe(true)
    expect(validateClaimSidecar('abcdef', [{ textRange: { start: 0, end: 4 }, kind: 'reliable-quote', evidenceIds: ['e1'] }, { textRange: { start: 3, end: 6 }, kind: 'modern-inference', evidenceIds: [] }], evidence)).toBe(false)
    expect(validateClaimSidecar('abcdef', [{ textRange: { start: 0, end: 2 }, kind: 'reliable-quote', evidenceIds: ['unknown'] }, { textRange: { start: 2, end: 6 }, kind: 'modern-inference', evidenceIds: [] }], evidence)).toBe(false)
    expect(validateClaimSidecar('abcdef', [{ textRange: { start: 0, end: 3 }, kind: 'modern-inference', evidenceIds: [] }, { textRange: { start: 4, end: 6 }, kind: 'insufficient-evidence', evidenceIds: [] }], evidence)).toBe(false)
  })
  it('requires the reliable marker on source rather than title or body', () => {
    const prefix = '> persona_id：`王阳明`\n'
    const card = (title: string, source: string) => `${prefix}### 【事迹卡 9】\n- **title**：${title}\n- **full_text**：正文\n- **source**：${source}\n`
    expect(parseResearchEvidence(card('标题✅', '《待核》⚠️'), 'wang-yangming')).toMatchObject([{ trust: 'restricted', evidenceType: 'attribution', firstPersonAllowed: false }])
    expect(parseResearchEvidence(card('标题', '《伪托》❌'), 'wang-yangming')).toEqual([])
    expect(parseResearchEvidence(card('标题✅', '《可靠》'), 'wang-yangming')).toMatchObject([{ trust: 'reliable' }])
    expect(parseResearchEvidence(card('标题', '《可靠》✅'), 'wang-yangming')).toHaveLength(1)
  })
  it('keeps card facts out of quote claims and strictly gates quote rows', () => {
    const card = '> persona_id：`王阳明`\n### 【事迹卡 8】\n- **title**：事实\n- **full_text**：原文记载\n- **source**：《史料》\n'
    expect(parseResearchEvidence(card, 'wang-yangming')[0]?.evidenceType).toBe('historical-fact')
    const table = (marker: string, source = '《传习录》') => [
      '> persona_id：`王阳明`', '| # | 语录原文 | 出处 | 关键词 | 可信度 |', '|---|---|---|---|---|', `| 8 | "知行" | ${source} | 知行 | ${marker} |`,
    ].join('\n')
    expect(parseResearchEvidence(table('✅'), 'wang-yangming').find(item => item.id.endsWith(':quote:8'))).toMatchObject({ evidenceType: 'quote', trust: 'reliable' })
    expect(parseResearchEvidence(table('✅*'), 'wang-yangming').find(item => item.id.endsWith(':quote:8'))).toMatchObject({ evidenceType: 'quote', trust: 'restricted', firstPersonAllowed: false })
    expect(parseResearchEvidence(table('⚠️'), 'wang-yangming').find(item => item.id.endsWith(':quote:8'))).toMatchObject({ trust: 'restricted' })
    expect(parseResearchEvidence(table('❌'), 'wang-yangming').find(item => item.id.endsWith(':quote:8'))).toBeUndefined()
    expect(parseResearchEvidence(table('MAYBE'), 'wang-yangming').find(item => item.id.endsWith(':quote:8'))).toBeUndefined()
    expect(parseResearchEvidence(table('✅', ''), 'wang-yangming').find(item => item.id.endsWith(':quote:8'))).toBeUndefined()
    expect(parseResearchEvidence(`${table('✅')} | extra | bad |`, 'wang-yangming').filter(item => item.id.endsWith(':quote:8'))).toEqual([])
  })
  it('parses registered persona evidence kinds without treating every reliable card as history', () => {
    const markdown = [
      '> persona_id：`庄子`',
      '### 【事迹卡 1】',
      '- **title**：蝴蝶梦',
      '- **evidence_kind**：寓言文本（内篇）',
      '- **full_text**：文本中的寓言',
      '- **source**：《齐物论》✅',
      '### 【事迹卡 2】',
      '- **title**：庄周史传',
      '- **evidence_kind**：史传记载',
      '- **full_text**：史传材料',
      '- **source**：《史记》✅',
      '### 【事迹卡 3】',
      '- **title**：产品解释',
      '- **evidence_kind**：现代阐释',
      '- **full_text**：现代产品化概括',
      '- **source**：审核说明✅',
    ].join('\n')
    expect(parseResearchEvidence(markdown, 'zhuangzi')).toMatchObject([
      { id: 'zhuangzi:research:1', evidenceType: 'textual-parable', firstPersonAllowed: false },
      { id: 'zhuangzi:research:2', evidenceType: 'historical-account', firstPersonAllowed: false },
      { id: 'zhuangzi:research:3', evidenceType: 'modern-interpretation', firstPersonAllowed: false },
    ])
  })
  it('accepts annotated trust markers while preserving speaker and text provenance', () => {
    const table = (persona: string, quote: string, source: string, marker: string) => [
      `> persona_id：\`${persona}\``,
      '| # | 语录原文 | 出处 | 关键词 | 可信度 |',
      '|---|---|---|---|---|',
      `| 1 | ${quote} | ${source} | 审核 | ${marker} |`,
    ].join('\n')
    expect(parseResearchEvidence(table('庄子', '「彼亦一是非。」', '《庄子·齐物论》', '✅'), 'zhuangzi')[0]).toMatchObject({
      evidenceType: 'textual-parable', trust: 'reliable', firstPersonAllowed: false,
    })
    expect(parseResearchEvidence(table('苏轼', '「此心安处是吾乡。」', '《定风波》寓娘答语', '✅ 他人语，禁冒领'), 'su-shi')[0]).toMatchObject({
      evidenceType: 'quoted-other-speaker', trust: 'reliable', firstPersonAllowed: false,
    })
    expect(parseResearchEvidence(table('朱熹', '「知之之要，未若行之之实。」', '《朱子语类》卷十三', '✅ 门人记录'), 'zhu-xi')[0]).toMatchObject({
      evidenceType: 'disciple-record', trust: 'reliable', firstPersonAllowed: false,
    })
  })
  it('uses source credibility only for card trust and accepts only anecdote headings', () => {
    const fact = '> persona_id：`王阳明`\n### 【事迹卡 2】\n- **title**：提及误传与待核\n- **full_text**：正文讨论伪托，但事实本身可靠\n- **source**：《可靠史料》✅\n'
    expect(parseResearchEvidence(fact, 'wang-yangming')[0]).toMatchObject({ evidenceType: 'historical-fact', trust: 'reliable' })
    const quoteHeading = '> persona_id：`王阳明`\n### 【语录 2】\n- **title**：语录\n- **full_text**：原文\n- **source**：《来源》✅\n'
    expect(parseResearchEvidence(quoteHeading, 'wang-yangming')).toEqual([])
    const emptySource = '> persona_id：`王阳明`\n### 【事迹卡 3】\n- **title**：事实\n- **full_text**：正文\n- **source**：✅\n'
    expect(parseResearchEvidence(emptySource, 'wang-yangming')).toEqual([])
    expect(parseResearchEvidence('> persona_id：`王阳明`\n### 【事迹卡 4】\n- **title**：事实\n- **full_text**：正文\n- **source**：《来源》MAYBE\n', 'wang-yangming')).toEqual([])
  })
})
