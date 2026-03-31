use proc_macro::TokenStream;
use proc_macro2::{Span, TokenStream as TokenStream2};
use quote::{format_ident, quote};
use syn::{Attribute, Fields, Item, ItemEnum, Path, Variant};

/// 展开 `enum_filter` attribute 宏。
pub(crate) fn expand(attr: TokenStream, item: TokenStream) -> TokenStream {
    match expand_impl(attr.into(), item.into()) {
        Ok(tokens) => tokens.into(),
        Err(error) => error,
    }
}

/// 解析 `enum_filter` 输入并生成展开结果。
fn expand_impl(attr: TokenStream2, item: TokenStream2) -> Result<TokenStream2, TokenStream> {
    let source =
        parse_source_path(attr).map_err(|error| TokenStream::from(error.to_compile_error()))?;
    let item =
        syn::parse2::<Item>(item).map_err(|error| TokenStream::from(error.to_compile_error()))?;

    let item_enum = match item {
        Item::Enum(item_enum) => item_enum,
        other => {
            return Err(TokenStream::from(
                syn::Error::new_spanned(other, "`enum_filter` can only be used on enums")
                    .to_compile_error(),
            ));
        }
    };

    let try_from_impl = expand_try_from_impl(&source, &item_enum);

    Ok(quote! {
        #item_enum
        #try_from_impl
    })
}

/// 解析 attribute 参数中的源 enum 路径。
fn parse_source_path(attr: TokenStream2) -> syn::Result<Path> {
    if attr.is_empty() {
        return Err(syn::Error::new(
            Span::call_site(),
            "expected source enum path, like `pattern::Color`",
        ));
    }

    syn::parse2::<Path>(attr.clone()).map_err(|_| {
        syn::Error::new_spanned(attr, "expected source enum path, like `pattern::Color`")
    })
}

/// 为目标 enum 生成 `TryFrom<Source>` 实现。
fn expand_try_from_impl(source: &Path, item_enum: &ItemEnum) -> TokenStream2 {
    let enum_ident = &item_enum.ident;
    let (impl_generics, ty_generics, where_clause) = item_enum.generics.split_for_impl();
    let match_arms = item_enum
        .variants
        .iter()
        .map(|variant| expand_variant_match_arm(source, variant));

    quote! {
        impl #impl_generics ::std::convert::TryFrom<#source> for #enum_ident #ty_generics #where_clause {
            type Error = #source;

            fn try_from(value: #source) -> ::std::result::Result<Self, Self::Error> {
                match value {
                    #(#match_arms,)*
                    other => Err(other),
                }
            }
        }
    }
}

/// 为单个目标变体生成对应的 match 分支。
fn expand_variant_match_arm(source: &Path, variant: &Variant) -> TokenStream2 {
    let source = quote! { ::tespat::SelfAlias::<#source> };
    let attrs = match_arm_attrs(&variant.attrs);
    let variant_ident = &variant.ident;

    match &variant.fields {
        Fields::Unit => {
            quote! {
                #(#attrs)*
                #source::#variant_ident => Ok(Self::#variant_ident)
            }
        }
        Fields::Unnamed(fields) => {
            let bindings: Vec<_> = fields
                .unnamed
                .iter()
                .enumerate()
                .map(|(index, _)| format_ident!("_{}", index))
                .collect();

            quote! {
                #(#attrs)*
                #source::#variant_ident(#(#bindings),*) => Ok(Self::#variant_ident(#(#bindings),*))
            }
        }
        Fields::Named(fields) => {
            let bindings: Vec<_> = fields
                .named
                .iter()
                .map(|field| {
                    field
                        .ident
                        .clone()
                        .expect("named fields should have identifiers")
                })
                .collect();

            quote! {
                #(#attrs)*
                #source::#variant_ident { #(#bindings),* } => Ok(Self::#variant_ident { #(#bindings),* })
            }
        }
    }
}

/// 仅保留对 match 分支有意义的条件编译属性。
fn match_arm_attrs(attrs: &[Attribute]) -> Vec<Attribute> {
    attrs
        .iter()
        .filter(|attr| attr.path().is_ident("cfg") || attr.path().is_ident("cfg_attr"))
        .cloned()
        .collect()
}
