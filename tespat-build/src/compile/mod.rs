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
    let color_map_support = generate_color_map_support(&project);
    let pattern_mod = pattern_module::generate_pattern_pair_module(&project)?;

    Ok(quote! {
        #color_enum
        #color_map_support
        #pattern_mod
    })
}

fn generate_color_map_support(project: &ProjectFile) -> TokenStream {
    let mut color_names: Vec<_> = project.palette.keys().copied().collect();
    color_names.sort();

    let field_idents: Vec<Ident> = color_names
        .iter()
        .map(|name| color_map_field_ident(name))
        .collect();

    let default_fields = color_names.iter().map(|name| {
        let field_ident = color_map_field_ident(name);
        let variant = color_variant_ident(name);

        quote! {
            #field_ident: ::tespat::MatchColor::Exact(Color::#variant),
        }
    });

    let color_map_type_doc = "A match-color table keyed by generated color names. \
                              Use `ColorMapStruct::DEFAULT` for the one-to-one `Color` mapping, \
                              or override individual fields to provide a custom mapping.";

    quote! {
        #[derive(Clone)]
        #[doc = #color_map_type_doc]
        pub struct ColorMapStruct {
            #(pub #field_idents: ::tespat::MatchColor<Color>,)*
        }

        impl ColorMapStruct {
            pub const DEFAULT: Self = Self {
                #(#default_fields)*
            };
        }

        pub trait ColorMapTrait {
            const MAP: ColorMapStruct;
        }

        pub static COLOR_MAP: ColorMapStruct =
            <() as ColorMapTrait>::MAP;
    }
}

fn generate_color_enum(ProjectFile { palette, .. }: &ProjectFile) -> TokenStream {
    let mut color_names: Vec<_> = palette.keys().collect();
    color_names.sort();

    let color_variants: Vec<_> = color_names
        .iter()
        .map(|name| color_variant_ident(name))
        .collect();

    let unit_pattern_items: Vec<_> = color_names
        .iter()
        .map(|&&name| {
            let static_pattern_ident = pattern_static_ident(name);

            let expr = pattern_module::generate_pattern_expr(1, &[name]);
            quote! {
                pub static #static_pattern_ident:
                    ::tespat::Pattern<super::Color> = #expr;
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
            #(#unit_pattern_items)*
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

fn color_map_field_ident(name: &str) -> Ident {
    cased_ident(name, Case::Snake)
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
