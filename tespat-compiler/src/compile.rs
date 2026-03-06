use std::collections::HashMap;

use anyhow::{Context, Result};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use serde::Deserialize;

/// 编译 tespat-web 项目文件
pub fn compile(file_content: String) -> Result<TokenStream> {
    let project: ProjectFile = serde_json::from_str(&file_content).context("解析 JSON 失败")?;

    let color_enum = generate_color_enum(&project.colors);
    let pattern_mod = generate_pattern_module(&project.patterns)?;

    Ok(quote! {
        #color_enum

        #pattern_mod
    })
}

fn generate_color_enum(colors: &HashMap<String, String>) -> TokenStream {
    let mut color_names: Vec<_> = colors.keys().collect();
    color_names.sort();

    let color_variants: Vec<_> = color_names
        .into_iter()
        .map(|name| color_variant_ident(name))
        .collect();

    quote! {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
        pub enum Color {
            #(#color_variants,)*
        }

        impl ::tespat::PatternColor for Color {}
    }
}

fn generate_pattern_module(patterns: &HashMap<String, PatternConfig>) -> Result<TokenStream> {
    let mut pattern_items = Vec::with_capacity(patterns.len());
    for (name, pattern) in patterns.iter() {
        pattern_items.push(generate_pattern_item(name, pattern));
    }

    Ok(quote! {
        pub mod pattern {
            use super::Color;

            #(#pattern_items)*
        }
    })
}

fn generate_pattern_item(name: &str, config: &PatternConfig) -> TokenStream {
    let mut grid_items = Vec::with_capacity(config.pattern.len());
    let mut first_seen_entries: HashMap<Option<&str>, usize> = HashMap::new();

    for (idx, color_name) in config.pattern.iter().enumerate() {
        if color_name == "*" {
            grid_items.push(quote! {None});
            first_seen_entries.entry(None).or_insert(idx);
        } else {
            let variant = color_variant_ident(color_name);
            grid_items.push(quote! { Some(Color::#variant) });
            first_seen_entries
                .entry(Some(color_name.as_str()))
                .or_insert(idx);
        }
    }

    let color_items: Vec<TokenStream> = first_seen_entries
        .into_iter()
        .map(|(entry, idx)| match entry {
            Some(color_name) => {
                let variant = color_variant_ident(color_name);
                quote! { (Some(Color::#variant), #idx) }
            }
            None => quote! { (None, #idx) },
        })
        .collect();

    let static_name = pattern_static_ident(name);
    let width = config.width;

    quote! {
        pub static #static_name: ::tespat::Pattern<Color> = {
            const WIDTH: usize = #width;
            const GRID: &[Option<Color>] = &[
                #(#grid_items,)*
            ];
            const COLORS: &[(Option<Color>, usize)] = &[
                #(#color_items,)*
            ];
            ::tespat::Pattern::from_static(WIDTH, GRID, COLORS)
        };
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

fn pattern_static_ident(name: &str) -> Ident {
    format_ident!("{}", sanitize_ident(&to_upper_snake_case(name)))
}

/// 转换为 PascalCase（用于 enum 变体）
fn to_pascal_case(s: &str) -> String {
    use convert_case::{Case, Casing};
    s.to_case(Case::Pascal)
}

/// 转换为 UPPER_SNAKE_CASE（用于静态字段名）
fn to_upper_snake_case(s: &str) -> String {
    use convert_case::{Case, Casing};
    s.to_case(Case::UpperSnake)
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

#[cfg(test)]
mod tests {
    use super::compile;

    fn compact(code: &str) -> String {
        code.chars().filter(|c| !c.is_whitespace()).collect()
    }

    #[test]
    fn generates_static_pattern_and_clone_function() {
        let json = r##"{
          "colors": {
            "Slime": "#22c55e",
            "Apple": "#ff4040",
            "Empty": "#1f2937"
          },
          "patterns": {
            "EatAppleMatch": {
              "width": 2,
              "pattern": ["Slime", "Apple"]
            }
          }
        }"##;

        let generated = compile(json.to_string())
            .expect("compile should succeed")
            .to_string();
        let generated = compact(&generated);

        assert!(generated.contains("pubstaticEAT_APPLE_MATCH"));
        assert!(generated.contains("Pattern::from_static(WIDTH,GRID,COLORS)"));
        assert!(generated.contains(
            "pubfneat_apple_match()->::tespat::Pattern<Color>{EAT_APPLE_MATCH.clone()}"
        ));
        assert!(!generated.contains("__EAT_APPLE_MATCH_GRID"));
        assert!(!generated.contains("__EAT_APPLE_MATCH_COLORS"));
    }

    #[test]
    fn rejects_non_multiple_width_pattern_len() {
        let json = r##"{
          "colors": {
            "Slime": "#22c55e"
          },
          "patterns": {
            "Bad": {
              "width": 2,
              "pattern": ["Slime", "Slime", "Slime"]
            }
          }
        }"##;

        assert!(compile(json.to_string()).is_err());
    }

    #[test]
    fn rejects_unknown_color_reference() {
        let json = r##"{
          "colors": {
            "Slime": "#22c55e"
          },
          "patterns": {
            "Bad": {
              "width": 1,
              "pattern": ["Ghost"]
            }
          }
        }"##;

        assert!(compile(json.to_string()).is_err());
    }
}
