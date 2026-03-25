use std::collections::HashMap;

use anyhow::{Context, Result};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use serde::Deserialize;

/// 编译 tespat-web 项目文件
pub fn compile(file_content: String) -> Result<TokenStream> {
    let project: ProjectFile = serde_json::from_str(&file_content).context("解析 JSON 失败")?;

    let color_enum = generate_color_enum(&project.palette);
    let pattern_mod = generate_pattern_module(&project.patterns)?;

    Ok(quote! {
        #color_enum

        #pattern_mod
    })
}

fn generate_color_enum(palette: &HashMap<&str, PaletteConfig>) -> TokenStream {
    let mut color_names: Vec<_> = palette.keys().filter(|name| **name != "*").collect();
    color_names.sort();

    let color_variants: Vec<_> = color_names
        .iter()
        .map(|name| color_variant_ident(name))
        .collect();

    let unit_pattern_match_arms: Vec<_> = color_variants
        .iter()
        .map(|variant| {
            quote! {
                Self::#variant => {
                    static PATTERN: ::tespat::Pattern<Color> = ::tespat::Pattern::from_static(
                        1,
                        &[Some(Color::#variant)],
                        &[(Some(Color::#variant), 0)],
                    );
                    &PATTERN
                }
            }
        })
        .collect();

    quote! {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
        pub enum Color {
            #(#color_variants,)*
        }

        impl ::tespat::StrColor for Color {
            fn to_str(&self) -> &'static str {
                match self {
                    #(Self::#color_variants => #color_names,)*
                }
            }
            fn from_str(s: &str) -> Option<Self> {
                match s {
                    #(#color_names => Some(Self::#color_variants),)*
                    _ => None
                }
            }
        }

        impl ::tespat::GraphColor for Color {}

        impl ::tespat::StaticColor<Color> for Color {
            fn get_color_with_symmetry(
                &self,
                _symmetry: ::tespat::pattern::transform::Symmetry,
            ) -> Color {
                *self
            }
        }

        impl Color {
            #[allow(dead_code)]
            pub const fn unit_pattern(self) -> &'static ::tespat::Pattern<Self> {
                match self {
                    #(#unit_pattern_match_arms,)*
                }
            }
        }
    }
}

fn generate_pattern_module(patterns: &HashMap<&str, PatternConfig>) -> Result<TokenStream> {
    let mut pattern_items = Vec::with_capacity(patterns.len());
    for (name, pattern) in patterns.iter() {
        pattern_items.push(generate_pattern_pair_item(name, pattern));
    }

    Ok(quote! {
        pub mod pattern {
            #[allow(unused_imports)]
            use super::Color;

            #(#pattern_items)*
        }
    })
}

fn generate_pattern_pair_item(name: &str, config: &PatternConfig) -> TokenStream {
    let capture = generate_pattern_expr(config.width, &config.capture);
    let replace = generate_pattern_expr(config.width, &config.replace);
    let static_name = pattern_static_ident(name);

    quote! {
        pub static #static_name: (
            ::tespat::Pattern<Color>,
            ::tespat::Pattern<Color>
        ) = (
            #capture,
            #replace,
        );
    }
}

fn generate_pattern_expr(width: usize, pattern: &[&str]) -> TokenStream {
    let mut grid_items = Vec::with_capacity(pattern.len());
    let mut first_seen_entries: HashMap<Option<&str>, usize> = HashMap::new();

    for (idx, &color_name) in pattern.iter().enumerate() {
        if color_name == "*" {
            grid_items.push(quote! {None});
            first_seen_entries.entry(None).or_insert(idx);
        } else {
            let variant = color_variant_ident(color_name);
            grid_items.push(quote! { Some(Color::#variant) });
            first_seen_entries.entry(Some(color_name)).or_insert(idx);
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

    quote! {
        {
            const WIDTH: usize = #width;
            const GRID: &[Option<Color>] = &[
                #(#grid_items,)*
            ];
            const COLORS: &[(Option<Color>, usize)] = &[
                #(#color_items,)*
            ];
            ::tespat::Pattern::from_static(WIDTH, GRID, COLORS)
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
