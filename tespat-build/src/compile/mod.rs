use std::collections::HashMap;

use anyhow::{Context, Result};
use convert_case::Case;
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use serde::Deserialize;

mod pattern_module;

/// 编译 tespat-web 项目文件
pub fn compile(file_content: String) -> Result<TokenStream> {
    let project: ProjectFile = serde_json::from_str(&file_content).context("解析 JSON 失败")?;

    let color_enum = generate_color_enum(&project);
    let pattern_mod = pattern_module::generate_pattern_pair_module(&project)?;

    Ok(quote! {
        #color_enum
        #pattern_mod
    })
}

fn generate_color_enum(ProjectFile { palette, .. }: &ProjectFile) -> TokenStream {
    let mut color_names: Vec<_> = palette.keys().collect();
    color_names.sort();

    let color_variants: Vec<_> = color_names
        .iter()
        .map(|&&name| {
            let variant = color_variant_ident(name);
            let palette_config = palette
                .get(name)
                .expect("palette entry should exist for each color variant");
            let color = palette_config.color;
            let color_attr = match palette_config.icon {
                Some(icon) => quote! { #[color(name = #name, color = #color, icon = #icon)] },
                None => quote! { #[color(name = #name, color = #color)] },
            };

            quote! {
                #color_attr
                #variant
            }
        })
        .collect();

    quote! {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
        #[tespat::color(manual_map)]
        pub enum Color {
            #(#color_variants,)*
        }
    }
}

#[derive(Deserialize)]
struct ProjectFile<'a> {
    #[serde(borrow)]
    palette: HashMap<&'a str, PaletteConfig<'a>>,
    patterns: HashMap<&'a str, PatternConfig<'a>>,
}

#[derive(Deserialize)]
struct PaletteConfig<'a> {
    #[allow(dead_code)]
    #[serde(borrow)]
    color: &'a str,
    #[allow(dead_code)]
    #[serde(borrow)]
    icon: Option<&'a str>,
}

#[derive(Deserialize)]
struct PatternConfig<'a> {
    width: usize,
    #[serde(borrow)]
    capture: Vec<&'a str>,
    replace: Vec<&'a str>,
}

fn color_variant_ident(name: &str) -> Ident {
    cased_ident(name, Case::Pascal)
}

fn pattern_static_ident(name: &str) -> Ident {
    cased_ident(name, Case::UpperSnake)
}

/// 保留下划线前缀进行case转换
fn cased_ident(s: &str, case: Case) -> Ident {
    let underline_prefix = s.starts_with('_');
    let mut string = sanitize_ident(s);
    string = convert_case::Casing::to_case(&string, case);
    if string.is_empty() {
        string.push('_');
    }
    if string.chars().all(|c| c == '_') {
        string.push('_');
    }
    if underline_prefix {
        string.insert(0, '_');
    }

    format_ident!("{string}")
}

/// 名称限制：只允许字母、数字和下划线
fn sanitize_ident(name: &str) -> String {
    let mut sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();

    if sanitized.is_empty() {
        sanitized.push('_');
    } else if sanitized
        .chars()
        .next()
        .is_some_and(|first| first.is_ascii_digit())
    {
        sanitized.insert(0, '_');
    }

    sanitized
}
