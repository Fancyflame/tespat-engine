# TESPAT 引擎

**该文档主要由AI生成**

## 功能概况

TESPAT (TESseraPATtern) 是一个基于 Rust 的二维网格模式匹配与替换引擎，和[MarkovJunior](https://github.com/mxgmn/MarkovJunior)类似，适合做规则驱动的网格演化、自动机模拟、回合演算等场景。
引擎为我的独立游戏《ForsakenLine》随机场景生成而制作。

项目由三部分组成：

- `tespat-core`：核心运行时，负责模式匹配、替换、对称变换（旋转/翻转）以及历史帧记录。
- `tespat-compiler`：编译期工具，将 JSON 规则文件编译为 Rust 代码，便于在运行时直接使用静态 pattern。
- `tespat-web`：可视化编辑与回放工具，用于编辑规则、导入回放 JSON、按帧查看演化过程。

## 示例效果

**tespat-web模式编辑**
![模式编辑](./readme_sources/EditPattern.gif)

**tespat-web录制回放**
![录制回放](./readme_sources/Playback.gif)

## 如何安装

### 1) 环境要求

- Rust（建议 `stable`，需支持 2024 edition）
- Node.js（建议 `20+`）
- npm（随 Node.js 一起安装）

### 2) 安装 Rust 依赖

在仓库根目录执行：

```powershell
cargo build
```

### 3) 安装 Web 端依赖（可选，但推荐）

```powershell
cd tespat-web
npm install
```

## 如何使用

### 1) 运行内置示例（生成回放数据）

在仓库根目录执行：

```powershell
cargo run -p slime-eat-apple
```

执行后会在当前目录生成 `exported.json`（包含 `width` 和 `frames`），可用于回放查看。

### 2) 启动 Web 编辑与回放工具

```powershell
cd tespat-web
npm run dev
```

然后在浏览器打开终端输出的本地地址（通常是 `http://localhost:5173`）。

使用方式：

- 在左侧编辑颜色与 pattern 规则。
- 点击「回放录制」进入回放模式。
- 上传或拖拽导出的json（例子中是`exported.json`）查看每一帧结果。

### 3) 在 Rust 项目中接入自定义规则（最小流程）

1. 在tespat-web中创建一个 JSON 规则文件（结构包含 `patterns` 和 `colors`）。
2. 在 `build.rs` 中调用编译器：

```rust
fn main() {
    tespat_compiler::TespatCompiler::new()
        .include("your_rules.json", "example")
        .compile()
        .unwrap();
}
```

3. 在代码中引入生成结果并使用 pattern：

```rust
use tespat::include_tespat;

include_tespat!();

// 之后即可使用生成的模块，例如：
// example::pattern::YOUR_PATTERN_NAME
```
