# 定向检索提示

用于 [清理指引](../SKILL.md)。关键词只产生候选，需结合上下文判断；零命中不能证明没有问题。先让模式匹配已知正例，再信任搜索结果。

检索隐藏规则目录时使用 `--hidden`，排除参数放最后，避免后续 include 重新纳入 vendor、依赖、冻结归档、fixture、snapshot 与技能自身的引用示例。

```sh
rg -n --hidden -i 'this PR|this branch|this stack|later PR|previous commit|rejected in review' <scope> --glob '!vendor/**' --glob '!node_modules/**' --glob '!.agents/notes/archived/**'
rg -n --hidden '设计稿|评审|上一?轮|旧版|不再|以前|本版|遗留' <scope> --glob '!vendor/**' --glob '!node_modules/**' --glob '!.agents/notes/archived/**'
```

英文关键词保留原文，因为它们是检索输入。注意误报：签名请求所用的 key、运行时旧新对象交接、PR 流程文档本身、协议路径里的 v1、有效标准章节引用，以及决策的真实替代方案，都可能包含相同词语。按句子的技术作用判断，不将命中数量当作质量指标。
