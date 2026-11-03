# Agent Notes

Agent Note 保存工程决策的原因、替代方案、代价和验证边界。中文是主要人工维护语言，单篇 `.md` 即可；不保留另一语言正文、镜像或 sidecar。

## Layout and naming

路径为 `{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`。生命周期为 `proposed/`（尚未实施）、`implemented/`（已实施）或 `rejected/`（已否决）；日期记录首次提出时间。采用稳定的相对 Markdown 链接，不建立重复的集中索引。

## Classification

类别限定为 `feature`、`bug-fix`、`simplification`、`architecture`、`process`、`testing`，以 [目录实现](../../scripts/agent-note-tree.ts) 为准。运行时结构属于 architecture，围绕代码的维护政策与工具流程属于 process。

## Archiving and deletion

保留仍能解释当前行为、所有权、安全、持久化或重新引入条件的决策；不以篇幅、年代或语言作为删除依据。被取代的活动记录明确链接当前决定，部分替代保留仍有效的理由。删除或移动前查入链、保留独有理由，并确认任务授权。

[`archived/`](archived/AGENTS.md) 保存既有冻结历史，其语言文件、元数据和 sidecar 作为封存证据永久保留；不得修改、翻译、移动或删除，也不作为当前政策来源。现有封存校验不要求新中文单篇记录建立配对。新增归档需要先确认其格式与封存器兼容，普通维护不自动归档。

## When to write one

改变跨文件行为、结构、共享契约、持久化格式、验证策略或长期维护政策时，新增或更新一份拥有该决定的 Agent Note；机械文案修改无需记录。新增前搜索同主题记录，说明取代关系；不把旧决定重写成相反主张，也不为每次小改动增加记录。

## The file format

使用 [格式校验器](../../scripts/verify-agent-note-format.ts) 支持的 header 与章节。正文可以只用中文；标准英文小标题可用于保持已有工具兼容。说明当前已实施内容，不把计划写成已验收结果。

### The header block

前三行为：

```markdown
# Agent Note: <决策标题>

Status: implemented
```

状态与生命周期目录一致；可用 `proposed`、`implemented`、`rejected — <原因>`。

### The body skeleton

正文以 `## Problem` 开始；允许格式校验器支持的中文同义小标题。

#### `proposed/`

依次写 Problem、Proposal、Alternatives considered、Acceptance criteria、Risks；记录尚未实现的方案和验收条件。

#### `implemented/`

依次写 Problem、Decision、Alternatives considered、Consequences；可加入 Verification 或 Testing 说明真实结果及未验证边界。不得继续使用 Proposal、Plan、Migration plan、Acceptance criteria 表示已实施决定。

#### `rejected/`

保留原提案结构与真实否决原因；不编造替代方案或验证结果。

### Alternatives considered — mandatory

说明实际考虑过的选择及舍弃原因，采用加粗开头的段落或独立小标题。没有证据的历史选择不补造；老格式豁免由现有校验器限定，新记录不使用该豁免。

### Moving between lifecycles

移动活动记录时同步状态与相应章节结构，修复入链；实施完成后将方案改为当前决定并记录代价。移动或删除遵守当前任务的授权边界。

### Chinese counterparts

普通 `.md` 可以直接使用中文；`.zh.md` 只是已有路径，不表示必须存在英文兄弟文件或相同章节。只更新承担当前事实的文件；代码、类型、链接和冻结封存检查仍按各自职责执行。
