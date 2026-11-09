# 文档站适配规则

遵守 [根规则](../AGENTS.md)、[文档规则](../docs/AGENTS.md) 与 [同步工作流](../.agents/skills/dsh-doc-site-sync/SKILL.md)。

`website/` 只保存 VitePress 配置、显示资源和 [发布映射](docs.ts)，本文件是此目录唯一人工 Markdown。正文和生成参考留在各自 `docs/` 层级，活动页面统一读取一份中文 canonical `.md`；兼容 `/en/` 路由可指向同一份正文，不要求英文副本。

投影器写入被忽略的 `.generated/`，构建写入 `.dist/`；不得手改或提交这些目录、缓存、复制文档树或语言树。原始 Markdown 镜像和 `llms.txt` 同样由映射生成，不是此目录的人工作品。

映射变化运行对应投影测试；影响站点路由、资源或渲染时运行必要站点检查。生成或本地预览不等于对外发布，不自动增加部署工作流、域名或托管配置。
