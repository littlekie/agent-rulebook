# Agent Rulebook

**为项目初始化 AI 开发规范、审查规则和质量检查配置的 CLI。**

[English](README.md) · [项目配置](docs/configuration.md) · [参与贡献](CONTRIBUTING.md)

适用于多个项目，支持按项目配置检查命令、风险路径与必要检查。
提供英文和简体中文模板。CLI 需要 Python 3.10+，没有运行时第三方依赖，不需要 API Key；
目标仓库可以使用任意编程语言。

## 开始使用

获取源码并安装：

```sh
git clone https://github.com/littlekie/agent-rulebook.git
cd agent-rulebook
python -m venv .venv
# macOS / Linux：
source .venv/bin/activate
# Windows PowerShell 改用：.venv\Scripts\Activate.ps1
python -m pip install .

agent-rulebook init ../my-project --language zh-CN
agent-rulebook init ../my-project --language zh-CN --apply
agent-rulebook doctor ../my-project
```

第一次只预览，第二次创建文件，第三次报告本地配置缺口。
初始检查命令为 null，doctor 返回待配置是预期结果。请填入真实命令并按生成的 SETUP.md 接入。
当前为早期源码版本，不代表同名 PyPI 包由本项目发布；使用本源码或经核实的发行 wheel 安装。
也支持 `python -m agent_rulebook`。

## 生成内容

| 文件 | 用途 |
| --- | --- |
| AGENTS.md | 简短开发规范入口 |
| REVIEW.md | 独立代码审查要求 |
| docs/ai-governance/engineering.md | 详细开发规范、验收依据和架构约束 |
| docs/ai-governance/SETUP.md | CI、审查服务和可信门禁接入说明 |
| docs/ai-governance/LICENSE | 生成材料的 MIT 许可证 |
| ci/commands.json | 项目真实检查命令 |
| ci/quality-policy.json | 风险下限与检查矩阵 |
| ci/ai-review-prompt.md | 独立审查指令与输出契约 |
| ci/quality_gate.py、ci/run_check.py | 证据判定核心与显式命令执行器 |
| ci/agent_rulebook.json | 初始模板清单与摘要 |
| ci/templates/github-checks.yml.example | 尚未激活的 CI 示例 |

CLI 不调用模型，不安装审查机器人，也不配置远程分支保护或执行合并。
规范用于指导 Agent，真实测试与受保护的 CI 才能提供强制检查。
门禁核心用于判定已认证证据的逻辑关系，生产接入还需要单独的可信控制器。
doctor 只读本地配置，既不执行项目命令，也不证明远程门禁已启用。

## 已有项目也可以接入

- 默认只预览，使用 --apply 才写入。
- 已有 AGENTS.md / REVIEW.md 保持原样，不同内容生成到 docs/ai-governance/ 下的建议稿。
- 其他文件有内容冲突时，整个初始化不写入；不提供强制覆盖选项。
- 相同输入重复初始化不改变内容与时间戳。
- 拒绝目标内部路径中的符号链接。

本工具负责初始化，生成文件由项目自行维护，不会后台同步或自动覆盖升级。
异常恢复边界见 [架构说明](docs/architecture.md)。

## 项目配置与审查

```sh
agent-rulebook init ../my-project --config examples/project.json --language zh-CN --apply
```

示例中的命令需要按项目替换；支持增加高风险路径与必要检查，保留默认风险下限。
完整字段与退出码见 [配置文档](docs/configuration.md)。

L0 对非行为性改动做必要检查与自查；L1 增加行为测试和独立审查；L2 对权限、资金、迁移、
核心架构等补充专项验证，并要求关键事项人工确认。默认一位独立代码审查者，按具体风险
增加安全专项；多个模型意见一致不能替代业务验收依据。合并与发布遵循项目既有授权。

本项目采用 [MIT](LICENSE) 许可证，独立开发，与其他同名仓库、Vercel 或模型供应商无隶属关系。
开发、测试及打包请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。
