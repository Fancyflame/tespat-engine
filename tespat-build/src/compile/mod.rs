mod codegen;
mod ir;
mod json;

use anyhow::{Context, Result};
use proc_macro2::TokenStream;

/// 编译 tespat-web 项目文件
pub fn compile(file_content: String) -> Result<TokenStream> {
    let parsed = json::parse_project_file(&file_content)?;
    let project = ir::ProjectFile::from_json(parsed)?;
    codegen::generate_project_tokens(&project).context("生成 Rust 代码失败")
}
