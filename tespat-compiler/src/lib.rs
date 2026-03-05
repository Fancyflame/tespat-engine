mod compile;

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use proc_macro2::TokenStream;
use quote::{format_ident, quote};

/// Tespat 模式编译器，用于在编译时将 tespat 文件编译为 Rust 代码。
#[derive(Default)]
#[must_use = "TespatCompiler does nothing if do not compile"]
pub struct TespatCompiler {
    includes: Vec<Include>,
}

/// 待编译的路径及其对应的模块名
struct Include {
    path: PathBuf,
    module_name: String,
}

impl TespatCompiler {
    pub fn new() -> Self {
        Self::default()
    }

    /// 添加待编译的路径。若为文件则直接编译；若为目录则递归编译，子项以文件名/目录名作为模块名。
    pub fn include(mut self, path: impl AsRef<Path>, module_name: &str) -> Self {
        self.includes.push(Include {
            path: path.as_ref().to_path_buf(),
            module_name: module_name.to_string(),
        });
        self
    }

    /// 执行编译，将结果写入 `OUT_DIR/tespat_generated.rs`。
    /// 需在 build.rs 中调用，以确保 `OUT_DIR` 环境变量已设置。
    pub fn compile(self) -> Result<()> {
        let out_dir = std::env::var("OUT_DIR").context("OUT_DIR 必须在 build.rs 中设置")?;
        let out_path = Path::new(&out_dir).join("tespat_generated.rs");

        // 对每个 include 递归处理，生成 mod 包裹的 TokenStream
        let mut modules = Vec::new();
        for include in self.includes {
            let content = process_path(&include.path, &include.module_name)?;
            modules.push(content);
        }

        // 将所有模块拼接为最终输出
        let output = quote! {
            #(#modules)*
        };

        std::fs::create_dir_all(&out_dir).context("创建 OUT_DIR 失败")?;
        std::fs::write(&out_path, output.to_string()).context("写入 tespat_generated.rs 失败")?;

        Ok(())
    }
}

/// 将名称转换为合法的 Rust 模块标识符
fn sanitize_module_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// 递归处理路径，生成 `mod module_name { ... }` 形式的 TokenStream。
/// - 若为文件：读取内容，调用 `compile::compile` 编译，用 mod 包裹
/// - 若为目录：递归处理子项，子文件以文件名（不含扩展名）为模块名，子目录以目录名为模块名
fn process_path(path: &Path, module_name: &str) -> Result<TokenStream> {
    if path.is_file() {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("读取文件失败: {}", path.display()))?;
        let compiled =
            compile::compile(content).context(format!("编译`{}`时出错", path.display()))?;
        let ident = format_ident!("{}", sanitize_module_name(module_name));

        match path.to_str() {
            Some(str_path) => println!("cargo:rerun-if-changed={str_path}"),
            None => println!(
                "cargo:warning=the file path `{}` includes non-UTF8 characters, \
                cannot rerun-if-changed",
                path.display()
            ),
        }

        Ok(quote! {
            pub mod #ident {
                #compiled
            }
        })
    } else if path.is_dir() {
        let mut entries: Vec<_> = std::fs::read_dir(path)
            .with_context(|| format!("读取目录失败: {}", path.display()))?
            .collect::<Result<Vec<_>, _>>()?;
        entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        let mut submodules = Vec::new();
        for entry in entries {
            let sub_path = entry.path();
            // 目录用目录名，文件用文件名（不含扩展名）作为子模块名
            let sub_module_name = if sub_path.is_dir() {
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
            let sub_mod = process_path(&sub_path, &sub_module_name)?;
            submodules.push(sub_mod);
        }

        let ident = format_ident!("{}", sanitize_module_name(module_name));
        // 用 mod 包裹所有子模块，形成嵌套结构
        Ok(quote! {
            pub mod #ident {
                #(#submodules)*
            }
        })
    } else {
        anyhow::bail!("路径不存在: {}", path.display())
    }
}
