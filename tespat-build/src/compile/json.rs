use std::collections::HashMap;

use anyhow::{Context, Result};
use serde::Deserialize;

use crate::compile::ir::{PaletteConfig, PatternConfig};

/// 解析新版递归项目 JSON。
pub(crate) fn parse_project_file(file_content: &str) -> Result<RecursiveNamespaceProjectFile<'_>> {
    serde_json::from_str(file_content).context("解析 JSON 失败")
}

/// 新版递归项目文件结构
#[derive(Deserialize)]
pub(crate) struct RecursiveNamespaceProjectFile<'a> {
    #[serde(default)]
    #[serde(borrow)]
    pub(crate) patterns: Vec<NamedPatternConfig<'a>>,
    #[serde(default)]
    #[serde(borrow)]
    pub(crate) palette: HashMap<&'a str, PaletteConfig<'a>>,
    #[serde(default)]
    #[serde(borrow)]
    pub(crate) children: Vec<RecursiveNamespaceChildProjectFile<'a>>,
}

/// 新版递归子命名空间节点
#[derive(Deserialize)]
pub(crate) struct RecursiveNamespaceChildProjectFile<'a> {
    #[serde(borrow)]
    pub(crate) name: &'a str,

    #[serde(default, borrow)]
    pub(crate) patterns: Vec<NamedPatternConfig<'a>>,

    #[serde(default, borrow)]
    pub(crate) palette: HashMap<&'a str, PaletteConfig<'a>>,

    #[serde(default, borrow)]
    pub(crate) children: Vec<RecursiveNamespaceChildProjectFile<'a>>,
}

/// 具名 pattern 配置
#[derive(Deserialize)]
pub(crate) struct NamedPatternConfig<'a> {
    #[serde(borrow)]
    pub(crate) name: &'a str,
    #[serde(flatten)]
    pub(crate) config: PatternConfig<'a>,
}
