mod compile;

use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};

/// Tespat 模式编译器，用于在编译时将 tespat 文件编译为 Rust 代码。
#[derive(Default)]
#[must_use = "TespatCompiler does nothing if do not compile"]
pub struct TespatCompiler {
    includes: Vec<PathBuf>,
}

impl TespatCompiler {
    pub fn new() -> Self {
        Self::default()
    }

    /// 添加待编译的路径。若为文件则输出为 `<文件名>.rs`；若为目录则递归输出到 `<目录名>/...`。
    pub fn include(mut self, path: impl AsRef<Path>) -> Self {
        self.includes.push(path.as_ref().to_path_buf());
        self
    }

    /// 执行编译，将结果写入 `OUT_DIR/tespat_generated/`。
    /// 需在 build.rs 中调用，以确保 `OUT_DIR` 环境变量已设置。
    pub fn compile(self) -> Result<()> {
        let out_dir = std::env::var("OUT_DIR").context("OUT_DIR 必须在 build.rs 中设置")?;
        let generated_dir = Path::new(&out_dir).join("tespat_generated");

        if generated_dir.exists() {
            std::fs::remove_dir_all(&generated_dir)
                .with_context(|| format!("清理输出目录失败: {}", generated_dir.display()))?;
        }

        std::fs::create_dir_all(&generated_dir)
            .with_context(|| format!("创建输出目录失败: {}", generated_dir.display()))?;

        let mut emitted_files = HashSet::new();
        for include_path in self.includes {
            let output_path = generated_dir.join(default_output_component(&include_path));
            process_path(&include_path, &output_path, &mut emitted_files)?;
        }

        Ok(())
    }
}

/// 根据源路径推导输出路径根名称。
fn default_output_component(path: &Path) -> String {
    let name = if path.is_dir() {
        path.file_name()
    } else {
        path.file_stem()
    }
    .and_then(|name| name.to_str())
    .unwrap_or("unknown");

    sanitize_output_component(name)
}

/// 将名称转换为安全的输出路径片段。
fn sanitize_output_component(name: &str) -> String {
    let mut sanitized: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ if c.is_control() => '_',
            _ => c,
        })
        .collect();

    if sanitized.is_empty() {
        sanitized.push('_');
    }

    sanitized
}

/// 递归处理路径，将编译结果写入输出目录。
fn process_path(
    path: &Path,
    output_path: &Path,
    emitted_files: &mut HashSet<PathBuf>,
) -> Result<()> {
    if path.is_file() {
        write_compiled_file(path, &output_path.with_extension("rs"), emitted_files)
    } else if path.is_dir() {
        std::fs::create_dir_all(output_path)
            .with_context(|| format!("创建输出目录失败: {}", output_path.display()))?;

        let mut entries: Vec<_> = std::fs::read_dir(path)
            .with_context(|| format!("读取目录失败: {}", path.display()))?
            .collect::<Result<Vec<_>, _>>()?;
        entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        for entry in entries {
            let sub_path = entry.path();
            let sub_output_name = if sub_path.is_dir() {
                sub_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            } else {
                sub_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            };

            let sub_output_path = output_path.join(sanitize_output_component(&sub_output_name));
            process_path(&sub_path, &sub_output_path, emitted_files)?;
        }

        Ok(())
    } else {
        anyhow::bail!("路径不存在: {}", path.display())
    }
}

/// 写入单个编译后的输出文件。
fn write_compiled_file(
    path: &Path,
    output_file: &Path,
    emitted_files: &mut HashSet<PathBuf>,
) -> Result<()> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("读取文件失败: {}", path.display()))?;
    let compiled = compile::compile(content).context(format!("编译`{}`时出错", path.display()))?;

    match path.to_str() {
        Some(str_path) => println!("cargo:rerun-if-changed={str_path}"),
        None => println!(
            "cargo:warning=the file path `{}` includes non-UTF8 characters, \
            cannot rerun-if-changed",
            path.display()
        ),
    }

    if !emitted_files.insert(output_file.to_path_buf()) {
        anyhow::bail!("生成输出冲突: {}", output_file.display());
    }

    if let Some(parent) = output_file.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("创建输出目录失败: {}", parent.display()))?;
    }

    std::fs::write(output_file, compiled.to_string())
        .with_context(|| format!("写入生成文件失败: {}", output_file.display()))?;

    Ok(())
}
