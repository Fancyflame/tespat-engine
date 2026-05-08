pub(crate) mod ident;
mod pattern_module;

use anyhow::Result;
use proc_macro2::TokenStream;
use quote::quote;

use crate::compile::ir::{ColorVariant, ProjectFile, VisibleColor};
use ident::color_map_field_ident;

/// 生成整个项目对应的 Rust TokenStream。
pub(crate) fn generate_project_tokens(project: &ProjectFile<'_>) -> Result<TokenStream> {
    let color_enum = generate_color_enum(project);
    let pattern_mod = pattern_module::generate_namespace_modules(project)?;

    Ok(quote! {
        #color_enum
        #pattern_mod
    })
}

/// 生成根颜色枚举和匹配颜色映射。
fn generate_color_enum(project: &ProjectFile<'_>) -> TokenStream {
    let variants = project.colors.iter().map(|color| {
        let variant = &color.variant_ident;
        quote! { #variant }
    });

    let debug_arms = project.colors.iter().map(|color| {
        let variant = &color.variant_ident;
        let debug_name = &color.debug_name;
        quote! { Self::#variant => f.write_str(#debug_name) }
    });

    let editor_palette_arms = project.colors.iter().map(|color| {
        let variant = &color.variant_ident;
        let editor_color = color.editor_color;
        let icon = match color.icon {
            Some(icon) => quote! { Some(#icon) },
            None => quote! { None },
        };

        quote! {
            Self::#variant => const {
                ::tespat::web_editor::EditorPalette::new_static(#editor_color, #icon)
            }
        }
    });

    let root_colors: Vec<_> = project
        .colors
        .iter()
        .filter(|color| color.namespace_path.is_empty())
        .collect();
    let root_color_map = generate_color_map_tokens(&root_colors);

    quote! {
        #[allow(non_camel_case_types)]
        #[derive(Clone, Copy, PartialEq, Eq, Hash)]
        pub enum Color {
            #(#variants,)*
        }

        impl ::std::fmt::Debug for Color {
            fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
                match self {
                    #(#debug_arms,)*
                }
            }
        }

        impl ::tespat::GraphColor for Color {}

        impl ::tespat::web_editor::GetEditorPalette for Color {
            fn get_editor_palette(&self) -> ::tespat::web_editor::EditorPalette {
                match self {
                    #(#editor_palette_arms,)*
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

        #root_color_map
    }
}

/// 生成指定命名空间的颜色映射定义。
pub(crate) fn generate_color_map_tokens(colors: &[&ColorVariant<'_>]) -> TokenStream {
    generate_color_map_tokens_from_visible(&colors_to_visible(colors))
}

/// 将 ColorVariant 视图转换为可见颜色视图。
fn colors_to_visible<'a>(colors: &[&'a ColorVariant<'a>]) -> Vec<VisibleColor<'a>> {
    colors
        .iter()
        .map(|color| VisibleColor {
            raw_name: color.raw_name,
            variant_ident: color.variant_ident.clone(),
        })
        .collect()
}

/// 生成指定命名空间的颜色映射定义（基于可见颜色集合）。
pub(crate) fn generate_color_map_tokens_from_visible(colors: &[VisibleColor<'_>]) -> TokenStream {
    let map_fields = colors.iter().map(|color| {
        let field_ident = color_map_field_ident(color.raw_name);
        quote! { pub #field_ident: ::tespat::MatchColor<Color>, }
    });

    let map_default_fields = colors.iter().map(|color| {
        let field_ident = color_map_field_ident(color.raw_name);
        let color_ident = crate::compile::codegen::ident::color_const_ident(color.raw_name);
        quote! { #field_ident: ::tespat::MatchColor::Exact(color::#color_ident), }
    });

    let map_match_arms = colors.iter().map(|color| {
        let field_ident = color_map_field_ident(color.raw_name);
        let color_ident = crate::compile::codegen::ident::color_const_ident(color.raw_name);
        quote! { color::#color_ident => self.#field_ident.const_copy(), }
    });

    quote! {
        pub struct ColorMapStruct {
            #(#map_fields)*
        }

        impl ColorMapStruct {
            pub const DEFAULT: Self = Self {
                #(#map_default_fields)*
            };

            pub const fn map(&self, color: Color) -> ::tespat::MatchColor<Color> {
                match color {
                    #(#map_match_arms)*
                    _ => ::tespat::MatchColor::Exact(color),
                }
            }
        }

        pub trait ColorMapTrait {
            const MAP: ColorMapStruct;
        }

        pub static COLOR_MAP: ColorMapStruct = <() as ColorMapTrait>::MAP;
    }
}
