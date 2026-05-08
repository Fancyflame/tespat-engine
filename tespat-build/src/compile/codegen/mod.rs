pub(crate) mod ident;
mod pattern_module;

use anyhow::Result;
use proc_macro2::TokenStream;
use quote::quote;

use crate::compile::ir::ProjectFile;
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

    let map_fields = project
        .colors
        .iter()
        .filter(|color| color.namespace_path.is_empty())
        .map(|color| {
            let field_ident = color_map_field_ident(color.raw_name);
            quote! { pub #field_ident: ::tespat::MatchColor<Color>, }
        });

    let map_default_fields = project
        .colors
        .iter()
        .filter(|color| color.namespace_path.is_empty())
        .map(|color| {
            let field_ident = color_map_field_ident(color.raw_name);
            let variant = &color.variant_ident;
            quote! { #field_ident: ::tespat::MatchColor::Exact(Color::#variant), }
        });

    let map_match_arms = project
        .colors
        .iter()
        .filter(|color| color.namespace_path.is_empty())
        .map(|color| {
            let field_ident = color_map_field_ident(color.raw_name);
            let variant = &color.variant_ident;
            quote! { Color::#variant => self.#field_ident.const_copy(), }
        });

    let root_variants = project
        .colors
        .iter()
        .filter(|color| color.namespace_path.is_empty());
    let non_root_variants = project
        .colors
        .iter()
        .filter(|color| !color.namespace_path.is_empty());

    let root_non_root_match = if root_variants.clone().next().is_some() {
        let root_arms = root_variants.map(|color| {
            let variant = &color.variant_ident;
            quote! { Color::#variant => true, }
        });
        let non_root_arms = non_root_variants.map(|color| {
            let variant = &color.variant_ident;
            quote! { Color::#variant => false, }
        });

        quote! {
            match color {
                #(#root_arms)*
                #(#non_root_arms)*
            }
        }
    } else {
        quote! { false }
    };

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

        impl Color {
            pub const fn to_match_color(self) -> ::tespat::MatchColor<Self> {
                COLOR_MAP.map(self)
            }
        }

        /// 按根命名空间颜色名索引的匹配颜色表。
        pub struct ColorMapStruct {
            #(#map_fields)*
        }

        impl ColorMapStruct {
            pub const DEFAULT: Self = Self {
                #(#map_default_fields)*
            };

            pub const fn map(&self, color: Color) -> ::tespat::MatchColor<Color> {
                if #root_non_root_match {
                    match color {
                        #(#map_match_arms)*
                        _ => ::tespat::MatchColor::Exact(color),
                    }
                } else {
                    ::tespat::MatchColor::Exact(color)
                }
            }
        }

        pub trait ColorMapTrait {
            const MAP: ColorMapStruct;
        }

        pub static COLOR_MAP: ColorMapStruct = <() as ColorMapTrait>::MAP;
    }
}
