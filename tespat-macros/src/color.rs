use convert_case::Case;
use darling::{FromMeta, FromVariant, ast::NestedMeta, util::Flag};
use proc_macro::TokenStream;
use proc_macro2::{Span, TokenStream as TokenStream2};
use quote::{format_ident, quote};
use syn::{Attribute, Ident, Item, ItemEnum, Meta, Token, Variant, punctuated::Punctuated};

/// 展开 `color` attribute 宏。
pub(crate) fn expand(attr: TokenStream, item: TokenStream) -> TokenStream {
    match expand_impl(attr.into(), item.into()) {
        Ok(tokens) => tokens.into(),
        Err(error) => error.into(),
    }
}

/// 解析宏参数与目标 enum，并委托到真正的展开逻辑。
fn expand_impl(attr: TokenStream2, item: TokenStream2) -> Result<TokenStream2, TokenStream2> {
    let args = parse_args(attr).map_err(|error| error.write_errors())?;
    let item = syn::parse2::<Item>(item).map_err(|error| error.to_compile_error())?;

    let item_enum = match item {
        Item::Enum(item_enum) => item_enum,
        other => {
            return Err(
                syn::Error::new_spanned(other, "`color` can only be used on enums")
                    .to_compile_error(),
            );
        }
    };

    let cleaned_enum = strip_variant_color_attrs(&item_enum);
    let parsed = ParsedColorEnum::from_item_enum(args, &item_enum)
        .map_err(|error| error.to_compile_error())?;

    Ok(expand_color_enum(cleaned_enum, &parsed))
}

/// enum 级别的 `#[tespat::color(...)]` 参数。
#[derive(Debug, Default, FromMeta)]
struct ColorArgs {
    #[darling(default)]
    manual_map: bool,
}

/// 解析 `#[tespat::color(...)]` 的参数列表。
fn parse_args(attr: TokenStream2) -> darling::Result<ColorArgs> {
    if attr.is_empty() {
        return Ok(ColorArgs::default());
    }

    let nested = NestedMeta::parse_meta_list(attr)?;
    ColorArgs::from_list(&nested)
}

/// 将输入 enum 归一化成后续展开需要的结构化信息。
#[derive(Debug, Clone)]
struct ParsedColorEnum {
    ident: Ident,
    manual_map: bool,
    variants: Vec<ParsedColorVariant>,
}

impl ParsedColorEnum {
    fn from_item_enum(args: ColorArgs, item_enum: &ItemEnum) -> syn::Result<Self> {
        if !item_enum.generics.params.is_empty() || item_enum.generics.where_clause.is_some() {
            return Err(syn::Error::new_spanned(
                &item_enum.generics,
                "`color` does not support generic enums",
            ));
        }

        let known_variants: Vec<_> = item_enum
            .variants
            .iter()
            .map(|variant| variant.ident.clone())
            .collect();

        let variants = item_enum
            .variants
            .iter()
            .map(|variant| {
                ParsedColorVariant::from_variant(args.manual_map, &known_variants, variant)
            })
            .collect::<syn::Result<Vec<_>>>()?;

        Ok(Self {
            ident: item_enum.ident.clone(),
            manual_map: args.manual_map,
            variants,
        })
    }
}

/// 直接由 darling 从 variant 上的 `#[color(...)]` 读取原始字段。
#[derive(Debug, FromVariant)]
#[darling(attributes(color), supports(unit))]
struct VariantInput {
    ident: Ident,
    #[darling(default)]
    name: Option<String>,
    color: String,
    #[darling(default)]
    icon: Option<String>,
    #[darling(default)]
    ignore: Flag,
    #[darling(default)]
    exact: Flag,
    #[darling(default)]
    any_of: Option<VariantList>,
    #[darling(default)]
    not_in: Option<VariantList>,
}

/// 经过校验和补全后的 variant 元数据。
#[derive(Debug, Clone)]
struct ParsedColorVariant {
    ident: Ident,
    name: String,
    palette_color: String,
    icon: Option<String>,
    unit_pattern_ident: Ident,
    color_map_field_ident: Ident,
    match_mode: MatchMode,
}

impl ParsedColorVariant {
    fn from_variant(
        manual_map: bool,
        known_variants: &[Ident],
        variant: &Variant,
    ) -> syn::Result<Self> {
        let input = VariantInput::from_variant(variant)
            .map_err(|error| syn::Error::new_spanned(variant, error.to_string()))?;

        let name = input.name.unwrap_or_else(|| input.ident.to_string());
        let explicit_mode_count: usize = [
            input.ignore.is_present(),
            input.exact.is_present(),
            input.any_of.is_some(),
            input.not_in.is_some(),
        ]
        .into_iter()
        .filter(|x| *x)
        .count();

        if manual_map && explicit_mode_count > 0 {
            return Err(syn::Error::new_spanned(
                variant,
                "`manual_map` enums cannot specify variant color modes",
            ));
        }

        if explicit_mode_count > 1 {
            return Err(syn::Error::new_spanned(
                variant,
                "specify at most one of `ignore`, `exact`, `any_of(...)`, or `not_in(...)`",
            ));
        }

        let match_mode = if input.ignore.is_present() {
            MatchMode::Ignore
        } else if let Some(any_of) = input.any_of {
            validate_variant_refs(&any_of.0, known_variants, variant)?;
            MatchMode::AnyOf(any_of.0)
        } else if let Some(not_in) = input.not_in {
            validate_variant_refs(&not_in.0, known_variants, variant)?;
            MatchMode::NotIn(not_in.0)
        } else {
            MatchMode::Exact
        };

        Ok(Self {
            ident: input.ident,
            name: name.clone(),
            palette_color: input.color,
            icon: input.icon,
            unit_pattern_ident: pattern_static_ident(&name),
            color_map_field_ident: color_map_field_ident(&name),
            match_mode,
        })
    }
}

/// 校验 `any_of(...)` / `not_in(...)` 中引用的 variant 是否都存在。
fn validate_variant_refs(
    refs: &[Ident],
    known_variants: &[Ident],
    variant: &Variant,
) -> syn::Result<()> {
    for ident in refs {
        if !known_variants.iter().any(|known| known == ident) {
            return Err(syn::Error::new_spanned(
                variant,
                format!("unknown color variant `{ident}` in color mode"),
            ));
        }
    }

    Ok(())
}

/// variant 最终会展开成的 `MatchColor` 模式。
#[derive(Debug, Clone)]
enum MatchMode {
    Exact,
    Ignore,
    AnyOf(Vec<Ident>),
    NotIn(Vec<Ident>),
}

impl MatchMode {
    fn expand_expr(&self, current_ident: &Ident) -> TokenStream2 {
        match self {
            Self::Exact => quote! { ::tespat::MatchColor::Exact(Self::#current_ident) },
            Self::Ignore => quote! { ::tespat::MatchColor::Ignore },
            Self::AnyOf(variants) => {
                quote! { ::tespat::MatchColor::any_of(&[#(Self::#variants),*]) }
            }
            Self::NotIn(variants) => {
                quote! { ::tespat::MatchColor::not_in(&[#(Self::#variants),*]) }
            }
        }
    }
}

/// 解析 `any_of(A, B, ...)` / `not_in(A, B, ...)` 里的 variant 列表。
#[derive(Debug, Clone)]
struct VariantList(Vec<Ident>);

impl FromMeta for VariantList {
    fn from_meta(meta: &Meta) -> darling::Result<Self> {
        let idents = meta
            .require_list()?
            .parse_args_with(Punctuated::<Ident, Token![,]>::parse_terminated)
            .map_err(darling::Error::from)?
            .into_iter()
            .collect::<Vec<_>>();

        if idents.is_empty() {
            return Err(darling::Error::custom(
                "expected at least one variant in the list",
            ));
        }

        Ok(Self(idents))
    }
}

/// 生成 `color` 宏的全部配套代码。
///
/// 这里直接复用用户传入的 enum 定义，不会给目标 enum 自动添加任何注释。
fn expand_color_enum(item_enum: ItemEnum, parsed: &ParsedColorEnum) -> TokenStream2 {
    let enum_ident = &parsed.ident;

    let from_str_arms = parsed.variants.iter().map(|variant| {
        let ident = &variant.ident;
        let name = &variant.name;
        quote! { #name => Ok(Self::#ident) }
    });

    let to_str_arms = parsed.variants.iter().map(|variant| {
        let ident = &variant.ident;
        let name = &variant.name;
        quote! { Self::#ident => #name }
    });

    let editor_palette_arms = parsed.variants.iter().map(|variant| {
        let ident = &variant.ident;
        let color = &variant.palette_color;
        let icon = match &variant.icon {
            Some(icon) => quote! { Some(#icon) },
            None => quote! { None },
        };

        quote! {
            Self::#ident => const {
                ::tespat::web_editor::EditorPalette::new_static(#color, #icon)
            }
        }
    });

    let to_match_color_arms = parsed.variants.iter().map(|variant| {
        let ident = &variant.ident;
        let expr = variant.match_mode.expand_expr(ident);
        quote! { Self::#ident => #expr }
    });

    let unit_pattern_items = parsed.variants.iter().map(|variant| {
        let ident = &variant.ident;
        let static_ident = &variant.unit_pattern_ident;

        quote! {
            pub static #static_ident: ::tespat::Pattern<super::#enum_ident> = {
                const WIDTH: usize = 1usize;
                const GRID: &[::tespat::MatchColor<super::#enum_ident>] = const {
                    &[super::#enum_ident::#ident.to_match_color()]
                };
                const COLORS: &[(::tespat::MatchColor<super::#enum_ident>, usize)] = const {
                    &[(super::#enum_ident::#ident.to_match_color(), 0usize)]
                };
                ::tespat::Pattern::from_static(WIDTH, GRID, COLORS)
            };
        }
    });

    let color_map_support = if parsed.manual_map {
        expand_manual_color_map_support(parsed, enum_ident)
    } else {
        TokenStream2::new()
    };

    let to_match_color_body = if parsed.manual_map {
        quote! {
            pub const fn to_match_color(self) -> ::tespat::MatchColor<Self> {
                COLOR_MAP.map(self)
            }
        }
    } else {
        quote! {
            pub const fn to_match_color(self) -> ::tespat::MatchColor<Self> {
                match self {
                    #(#to_match_color_arms,)*
                }
            }
        }
    };

    quote! {
        #item_enum

        impl ::std::str::FromStr for #enum_ident {
            type Err = ::tespat::ParseStrToColorError;

            fn from_str(s: &str) -> ::std::result::Result<Self, Self::Err> {
                match s {
                    #(#from_str_arms,)*
                    _ => Err(::tespat::ParseStrToColorError::from_str(s)),
                }
            }
        }

        impl ::tespat::StrColor for #enum_ident {
            fn to_str(&self) -> &'static str {
                match self {
                    #(#to_str_arms,)*
                }
            }
        }

        impl ::tespat::GraphColor for #enum_ident {}

        impl ::tespat::web_editor::GetEditorPalette for #enum_ident {
            fn get_editor_palette(&self) -> ::tespat::web_editor::EditorPalette {
                match self {
                    #(#editor_palette_arms,)*
                }
            }
        }

        impl ::tespat::StaticColor<#enum_ident> for #enum_ident {
            fn get_color_with_symmetry(
                &self,
                _symmetry: ::tespat::pattern::transform::Symmetry,
            ) -> #enum_ident {
                *self
            }
        }

        impl #enum_ident {
            #to_match_color_body
        }

        #[allow(dead_code)]
        pub mod unit_pattern {
            #(#unit_pattern_items)*
        }

        #color_map_support
    }
}

/// 在 `manual_map` 模式下生成可覆写的颜色映射表及辅助 trait。
fn expand_manual_color_map_support(parsed: &ParsedColorEnum, enum_ident: &Ident) -> TokenStream2 {
    let default_fields = parsed.variants.iter().map(|variant| {
        let field_ident = &variant.color_map_field_ident;
        let color_ident = &variant.ident;

        quote! {
            #field_ident: ::tespat::MatchColor::Exact(#enum_ident::#color_ident),
        }
    });

    let struct_fields = parsed.variants.iter().map(|variant| {
        let field_ident = &variant.color_map_field_ident;

        quote! {
            pub #field_ident: ::tespat::MatchColor<#enum_ident>,
        }
    });

    let map_match_arms = parsed.variants.iter().map(|variant| {
        let color_ident = &variant.ident;
        let field_ident = &variant.color_map_field_ident;

        quote! {
            #enum_ident::#color_ident => self.#field_ident.const_copy()
        }
    });

    let enum_name = enum_ident.to_string();
    let color_map_type_doc = format!(
        "按生成颜色名索引的匹配颜色表。\
         `ColorMapStruct::DEFAULT` 表示 `{enum_name}` 到自身的一一映射，\
         也可以覆写单个字段来自定义匹配规则。"
    );

    quote! {
        #[derive(Clone)]
        #[doc = #color_map_type_doc]
        pub struct ColorMapStruct {
            #(#struct_fields)*
        }

        impl ColorMapStruct {
            pub const DEFAULT: Self = Self {
                #(#default_fields)*
            };

            pub const fn map(&self, color: #enum_ident) -> ::tespat::MatchColor<#enum_ident> {
                match color {
                    #(#map_match_arms,)*
                }
            }
        }

        pub trait ColorMapTrait {
            const MAP: ColorMapStruct;
        }

        pub static COLOR_MAP: ColorMapStruct = <() as ColorMapTrait>::MAP;
    }
}

/// 清理 variant 上仅供宏内部消费的 `#[color(...)]` 辅助属性，
/// 避免它们原样残留到展开结果里。
fn strip_variant_color_attrs(item_enum: &ItemEnum) -> ItemEnum {
    let mut cleaned = item_enum.clone();
    for variant in &mut cleaned.variants {
        variant.attrs = filter_color_helper_attrs(&variant.attrs);
    }
    cleaned
}

/// 过滤掉 `#[color(...)]`，保留用户原本写在 variant 上的其他属性。
fn filter_color_helper_attrs(attrs: &[Attribute]) -> Vec<Attribute> {
    attrs
        .iter()
        .filter(|attr| !attr.path().is_ident("color"))
        .cloned()
        .collect()
}

/// 将原始颜色名转换成 `unit_pattern::FOO_BAR` 这类常量标识符。
fn pattern_static_ident(name: &str) -> Ident {
    cased_ident(name, Case::UpperSnake)
}

/// 将原始颜色名转换成 `ColorMapStruct` 的 snake_case 字段名。
fn color_map_field_ident(name: &str) -> Ident {
    cased_ident(name, Case::Snake)
}

/// 统一处理前导下划线和大小写转换，生成合法的 Rust 标识符。
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

    format_ident!("{string}", span = Span::call_site())
}

/// 将非法字符替换成下划线，并处理空串/数字开头这类非法标识符情况。
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
    use super::expand_impl;
    use quote::quote;

    fn expand_ok(attr: TokenStream2, item: TokenStream2) -> String {
        expand_impl(attr, item).unwrap().to_string()
    }

    fn expand_err(attr: TokenStream2, item: TokenStream2) -> String {
        expand_impl(attr, item).unwrap_err().to_string()
    }

    use proc_macro2::TokenStream as TokenStream2;

    #[test]
    fn expands_default_exact_mode_without_manual_map() {
        let output = expand_ok(
            quote! {},
            quote! {
                #[derive(Clone, Copy)]
                pub enum Palette {
                    #[color(name = "Empty", color = "#000000")]
                    Empty,
                }
            },
        );

        assert!(output.contains("pub const fn to_match_color"));
        assert!(output.contains("MatchColor :: Exact"));
        assert!(output.contains("Self :: Empty"));
        assert!(output.contains("impl :: std :: str :: FromStr for Palette"));
        assert!(output.contains("pub mod unit_pattern"));
        assert!(output.contains("pub static EMPTY : :: tespat :: Pattern < super :: Palette >"));
        assert!(!output.contains("ColorMapStruct"));
    }

    #[test]
    fn expands_variant_modes_without_manual_map() {
        let output = expand_ok(
            quote! {},
            quote! {
                #[derive(Clone, Copy)]
                pub enum Color {
                    #[color(name = "A", color = "#000000", ignore)]
                    A,
                    #[color(name = "B", color = "#111111", any_of(A, C))]
                    B,
                    #[color(name = "C", color = "#222222", not_in(A))]
                    C,
                }
            },
        );

        assert!(output.contains("MatchColor :: Ignore"));
        assert!(output.contains("MatchColor :: any_of"));
        assert!(output.contains("Self :: A"));
        assert!(output.contains("Self :: C"));
        assert!(output.contains("MatchColor :: not_in"));
    }

    #[test]
    fn expands_manual_map_support() {
        let output = expand_ok(
            quote! { manual_map },
            quote! {
                #[derive(Clone, Copy)]
                pub enum Palette {
                    #[color(name = "_PathHead", color = "#ff0000")]
                    _PathHead,
                    #[color(name = "RoomFloor", color = "#00ff00")]
                    RoomFloor,
                }
            },
        );

        assert!(output.contains("pub struct ColorMapStruct"));
        assert!(output.contains("pub _path_head : :: tespat :: MatchColor < Palette >"));
        assert!(output.contains("pub room_floor : :: tespat :: MatchColor < Palette >"));
        assert!(output.contains("pub const fn map (& self , color : Palette)"));
        assert!(output.contains("COLOR_MAP . map"));
        assert!(output.contains("pub static _PATH_HEAD"));
    }

    #[test]
    fn preserves_raw_name_mapping() {
        let output = expand_ok(
            quote! {},
            quote! {
                #[derive(Clone, Copy)]
                pub enum Color {
                    #[color(name = "snake-case", color = "#abcdef")]
                    SnakeCase,
                }
            },
        );

        assert!(output.contains("snake-case"));
        assert!(output.contains("Self :: SnakeCase"));
        assert!(output.contains("pub static SNAKE_CASE"));
    }

    #[test]
    fn rejects_variant_modes_with_manual_map() {
        let error = expand_err(
            quote! { manual_map },
            quote! {
                #[derive(Clone, Copy)]
                pub enum Color {
                    #[color(name = "Any", color = "#000000", ignore)]
                    Any,
                }
            },
        );

        assert!(error.contains("manual_map"));
        assert!(error.contains("variant color modes"));
    }

    #[test]
    fn rejects_multiple_variant_modes() {
        let error = expand_err(
            quote! {},
            quote! {
                #[derive(Clone, Copy)]
                pub enum Color {
                    #[color(name = "Any", color = "#000000", ignore, exact)]
                    Any,
                }
            },
        );

        assert!(error.contains("specify at most one"));
    }

    #[test]
    fn rejects_unknown_variant_refs() {
        let error = expand_err(
            quote! {},
            quote! {
                #[derive(Clone, Copy)]
                pub enum Color {
                    #[color(name = "Any", color = "#000000", any_of(Missing))]
                    Any,
                }
            },
        );

        assert!(error.contains("unknown color variant"));
        assert!(error.contains("Missing"));
    }
}
