use std::collections::HashMap;

use anyhow::{Context, Result};
use convert_case::Case;
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

    let unit_pattern_items: Vec<_> = color_names
        .iter()
        .zip(color_variants.iter())
        .map(|(&&name, variant)| {
            let static_pattern_ident = pattern_static_ident(name);
            quote! {
                pub static #static_pattern_ident: ::tespat::Pattern<Color> =
                    ::tespat::Pattern::from_static(
                        1,
                        &[Some(Color::#variant)],
                        &[(Some(Color::#variant), 0)],
                    );
            }
        })
        .collect();

    let as_editor_palette_match_arms: Vec<_> = color_names
        .iter()
        .zip(color_variants.iter())
        .map(|(name, variant)| {
            let palette_config = palette
                .get(*name)
                .expect("palette entry should exist for each color variant");
            let color = palette_config.color;
            let icon = match palette_config.icon {
                Some(icon) => quote! { Some(#icon) },
                None => quote! { None },
            };

            quote! {
                Self::#variant => const {
                    ::tespat::web_editor::EditorPalette::new_static(#color, #icon)
                }
            }
        })
        .collect();

    quote! {
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
        pub enum Color {
            #(#color_variants,)*
        }

        impl ::std::str::FromStr for Color {
            type Err = ::tespat::ParseStrToColorError;
            fn from_str(s: &str) -> ::std::result::Result<Self, Self::Err> {
                match s {
                    #(#color_names => Ok(Self::#color_variants),)*
                    _ => Err(::tespat::ParseStrToColorError::from_str(s))
                }
            }
        }

        impl ::tespat::StrColor for Color {
            fn to_str(&self) -> &'static str {
                match self {
                    #(Self::#color_variants => #color_names,)*
                }
            }
        }

        impl ::tespat::GraphColor for Color {}

        impl ::tespat::web_editor::GetEditorPalette for Color {
            fn get_editor_palette(&self) -> ::tespat::web_editor::EditorPalette {
                match self {
                    #(#as_editor_palette_match_arms,)*
                }
            }
        }

        impl ::tespat::StaticColor<Color> for Color {
            fn get_color_with_symmetry(
                &self,
                _symmetry: ::tespat::pattern::transform::Symmetry,
            ) -> Color {
                *self
            }
        }

        #[allow(dead_code)]
        pub mod unit_pattern {
            use super::Color;
            #(#unit_pattern_items)*
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
