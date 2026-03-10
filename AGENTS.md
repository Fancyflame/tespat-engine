# AGENTS.md

## 项目简介

TESPAT Engine 是一个基于 Rust 的二维网格模式匹配与替换引擎，用于规则驱动的网格演化、自动机场景模拟和随机内容生成；仓库同时包含规则可视化编辑/回放前端，以及将规则编译为 Rust 代码的编译器，便于按功能定位实现。

## 项目大结构

代码根目录下的大结构主要分为三部分：
- 前端：`tespat-web`
- 模式替换核心引擎：`tespat-core`
- 编译到 Rust 的 tespat 编译器：`tespat-compiler`

按功能查找代码时，可优先按职责定位：
- 编辑规则、导入导出、回放与界面交互：看 `tespat-web`
- 模式匹配、替换执行、对称变换、历史帧记录：看 `tespat-core`
- JSON 规则转 Rust 静态代码、编译期生成：看 `tespat-compiler`

## 提醒事项

- 搜索代码目录时，记得避开 `node_modules`、`dist` 和 `target` 目录。
