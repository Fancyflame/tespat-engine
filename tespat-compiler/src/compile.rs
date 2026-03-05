use std::collections::HashMap;

use anyhow::{Context, Result};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use serde::Deserialize;

/// 编译 tespat-web 项目文件
pub fn compile(file_content: String) -> Result<TokenStream> {
    let project: ProjectFile = serde_json::from_str(&file_content).context("解析 JSON 失败")?;

    let color_enum = generate_color_enum(&project.colors);
    let pattern_mod = generate_pattern_module(&project.patterns);

    Ok(quote! {
        #color_enum

        #pattern_mod
    })
}

fn generate_color_enum(colors: &HashMap<String, String>) -> TokenStream {
    let color_variants: Vec<_> = colors
        .keys()
        .map(|name| color_variant_ident(name))
        .collect();

    quote! {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
        pub enum Color {
            #(#color_variants,)*
        }

        impl ::tespat_runtime::PatternColor for Color {}
    }
}

fn generate_pattern_module(patterns: &HashMap<String, PatternConfig>) -> TokenStream {
    let pattern_fns: Vec<_> = patterns
        .iter()
        .map(|(name, config)| generate_pattern_fn(name, config))
        .collect();

    quote! {
        pub mod pattern {
            use super::Color;

            #(#pattern_fns)*
        }
    }
}

fn generate_pattern_fn(name: &str, config: &PatternConfig) -> TokenStream {
    let fn_name = pattern_fn_ident(name);
    let width = config.width;
    // "*" 表示空位，其他字符串映射为对应颜色枚举。
    let grid_items: Vec<TokenStream> = config
        .pattern
        .iter()
        .map(|color_name| {
            if color_name == "*" {
                quote! { None }
            } else {
                let variant = color_variant_ident(color_name);
                quote! { Some(Color::#variant) }
            }
        })
        .collect();

    quote! {
        pub fn #fn_name() -> ::tespat_runtime::Pattern<Color> {
            ::tespat_runtime::Pattern::new(
                #width,
                vec![#(#grid_items,)*],
            )
        }
    }
}

#[derive(Deserialize)]
struct ProjectFile {
    colors: HashMap<String, String>,
    patterns: HashMap<String, PatternConfig>,
}

#[derive(Deserialize)]
struct PatternConfig {
    width: usize,
    pattern: Vec<String>,
}

fn color_variant_ident(name: &str) -> Ident {
    format_ident!("{}", sanitize_ident(&to_pascal_case(name)))
}

fn pattern_fn_ident(name: &str) -> Ident {
    format_ident!("{}", sanitize_ident(&to_snake_case(name)))
}

/// 转换为 PascalCase（用于 enum 变体）
fn to_pascal_case(s: &str) -> String {
    use convert_case::{Case, Casing};
    s.to_case(Case::Pascal)
}

/// 转换为 snake_case（用于函数名）
fn to_snake_case(s: &str) -> String {
    use convert_case::{Case, Casing};
    s.to_case(Case::Snake)
}

/// 名称限制：只允许字母、数字和下划线
fn sanitize_ident(name: &str) -> String {
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
