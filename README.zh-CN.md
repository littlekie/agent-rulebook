# Agent Rulebook

**为项目初始化 AI 开发规范、审查规则和质量检查配置的 npm CLI。**

[English](README.md) · [配置](docs/configuration.md) · [旧版本迁移](docs/migration-v0.2.md) · [参与贡献](CONTRIBUTING.md)

使用 TypeScript 实现，CLI 和生成的检查脚本需要 **Node.js 22+**，无需 Python。
可用于 JavaScript、TypeScript、Java、Go、Rust、Python 等任意技术栈的项目。
支持中英文规范、项目命令配置及风险分级。

## 通过 GitHub 源码直接运行

包名为 `@littlekie/agent-rulebook`，目前尚未发布到 npm 注册表。
npm 上不带账号前缀的 `agent-rulebook` 是其他项目，请使用下面的 GitHub 地址：

```sh
npx --yes --package=git+https://github.com/littlekie/agent-rulebook.git agent-rulebook init ./my-project --language zh-CN
npx --yes --package=git+https://github.com/littlekie/agent-rulebook.git agent-rulebook init ./my-project --language zh-CN --apply
npx --yes --package=git+https://github.com/littlekie/agent-rulebook.git agent-rulebook doctor ./my-project
```

Git 安装需要 Git 和网络，npm 会通过 prepare 脚本构建源码。
需要固定版本时，在 Git URL 后加 `#已审查的提交SHA`。初始化过程本身不联网。
第一步只预览，第二步写入，第三步检查本地配置。初始命令为 null，doctor 返回退出码 1 是预期结果。

也可以从源码打包安装：

```sh
git clone https://github.com/littlekie/agent-rulebook.git
cd agent-rulebook
npm ci
npm pack
npm install --global ./littlekie-agent-rulebook-0.2.0.tgz
agent-rulebook init ../my-project --language zh-CN
```

npm 安装包已包含所需运行代码，目标项目不需要额外安装 npm 依赖。
Windows 的命令启动支持由内置 cross-spawn 提供，生成脚本保留其许可证声明。

## 生成内容

| 文件 | 用途 |
| --- | --- |
| AGENTS.md、REVIEW.md | 开发规范入口与独立审查要求 |
| docs/ai-governance/engineering.md | 详细规范、验收依据、架构约束及风险等级 |
| docs/ai-governance/SETUP.md、LICENSE | 接入说明及生成材料许可证 |
| ci/commands.json | 项目真实检查命令，可调用 npm/pnpm、Maven/Gradle、Go、Cargo 等 |
| ci/quality-policy.json | 风险下限与必要检查矩阵 |
| ci/ai-review-prompt.md | 独立审查指令及输出契约 |
| ci/quality-gate.mjs、ci/run-check.cjs | 证据判定核心及命令执行器 |
| ci/agent_rulebook.json | 初始模板清单与摘要 |
| ci/templates/github-checks.yml.example | 尚未激活的 CI 示例 |

目标项目无需改造成 Node 项目，但运行检查器需要 Node.js。
项目自身工具链和检查命令由项目配置，本工具不会自动安装或猜测。

已有规范保留原样，不同内容生成建议稿；其他文件冲突则整批不写入。
相同输入重复初始化保留内容和时间戳，拒绝目标内部符号链接。
生成文件由项目维护，不进行后台同步或强制升级。旧 Python 版本请按迁移说明整合。

## 审查与接入边界

L0 做必要检查与自查；L1 增加行为测试和独立审查；L2 对权限、资金、迁移、核心架构等
补充专项验证，并要求关键事项人工确认。默认一位独立代码审查者，按具体风险增加安全专项。

CLI 不调用模型、不配置远程保护、不批准或合并 PR。doctor 不执行项目代码。
规范指导 Agent，真实测试与受保护的 CI 提供强制检查。
门禁核心不认证证据来源，生产接入还需可信控制器，详见生成的 SETUP.md。

采用 [MIT](LICENSE) 许可证，与其他同名项目、Vercel 或模型供应商无隶属关系。
