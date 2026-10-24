import type { PersonaId } from '@deepseek-ai/dsh-man-roleplayer/types'

export interface PersonaPresentation {
  readonly portrait: string
  readonly era: string
  readonly seal: string
  readonly tagline: string
  readonly themes: readonly string[]
  readonly question: string
  readonly fit: string
  readonly method: string
  readonly source: string
}

const PRESENTATIONS: Readonly<Record<PersonaId, PersonaPresentation>> = {
  'wang-yangming': {
    portrait: '/man-roleplayer/portraits/wang-yangming.png', era: '明 · 心学', seal: '行',
    tagline: '此心有光，事上磨炼', themes: ['知行', '抉择', '行动'],
    question: '如果暂时不问别人，你心里已经知道该做什么？',
    fit: '知道道理却行动困难，或在他人期待中失去自己的判断。',
    method: '把内心判断落到眼前的一件小事，用行动重新检验。', source: '《传习录》等正式调研资料',
  },
  'zeng-guofan': {
    portrait: '/man-roleplayer/portraits/zeng-guofan.png', era: '清 · 经世', seal: '恒',
    tagline: '日日有功，稳步向前', themes: ['习惯', '复盘', '担当'],
    question: '今天能做完、明天还能继续做的一小步，是什么？',
    fit: '目标太远、执行反复，需要在日常功课中重新建立秩序。',
    method: '拆解功课，留意处事分寸，持续复盘自己的进退。', source: '《曾国藩家书》等正式调研资料',
  },
  zhuangzi: {
    portrait: '/man-roleplayer/portraits/zhuangzi.png', era: '先秦 · 道家', seal: '游',
    tagline: '换一种尺度，看天地', themes: ['得失', '自由', '视角'],
    question: '你拿来衡量自己的那把尺，是否只有这一把？',
    fit: '被得失、比较和“有没有用”困住，想松动一个僵硬的看法。',
    method: '借寓言与反问，重新看见处境中的余地。', source: '《庄子》分篇文本与史传资料',
  },
  'su-shi': {
    portrait: '/man-roleplayer/portraits/su-shi.png', era: '宋 · 旷达', seal: '旷',
    tagline: '处境有界，心有余地', themes: ['挫折', '生活', '自处'],
    question: '眼前还没有改变的处境里，什么仍然值得你认真生活？',
    fit: '经历失意或变化，想重新安顿情绪、找回生活的质地。',
    method: '从具体生活与多重视角里寻找可安顿之处。', source: '苏轼诗文与经核验的生平资料',
  },
  'zhu-xi': {
    portrait: '/man-roleplayer/portraits/zhu-xi.png', era: '宋 · 理学', seal: '理',
    tagline: '循序致精，辨明事理', themes: ['求知', '辨析', '次序'],
    question: '这个判断依据什么？其中哪一步，还没有弄明白？',
    fit: '问题混在一起、依据不清，想更有次序地理解与判断。',
    method: '分清概念、核对根据，再逐步推进自己的认识。', source: '《朱子语类》等正式调研资料',
  },
}

/** Return product presentation copy and the published portrait URL for a registered persona.
 * @param id - Stable identifier from the product persona roster.
 * @returns Curated presentation text and the portrait asset URL.
 */
export function getPersonaPresentation(id: PersonaId): PersonaPresentation {
  return PRESENTATIONS[id]
}
