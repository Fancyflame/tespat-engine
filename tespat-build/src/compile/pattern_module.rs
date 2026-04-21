use crate::compile::ProjectFile;

use super::color_variant_ident;
use super::pattern_static_ident;

use proc_macro2::TokenStream;

use anyhow::Result;
use quote::quote;

use super::PatternConfig;

use std::collections::HashMap;

pub(crate) fn generate_pattern_pair_module(
    ProjectFile { patterns, .. }: &ProjectFile<'_>,
) -> Result<TokenStream> {
    let mut pattern_items = Vec::with_capacity(patterns.len());
    for (name, pattern) in patterns.iter() {
        pattern_items.push(generate_pattern_pair_item(name, pattern));
    }

    Ok(quote! {
        pub mod pattern {
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
            ::tespat::Pattern<super::Color>,
            ::tespat::Pattern<super::Color>
        ) = (
            #capture,
            #replace,
        );
    }
}

/// 生成用于static PATTERN的表达式
pub fn generate_pattern_expr(width: usize, pattern: &[&str]) -> TokenStream {
    let mut grid_items = Vec::with_capacity(pattern.len());
    let mut first_seen_entries: HashMap<&str, usize> = HashMap::new();

    for (idx, &color_name) in pattern.iter().enumerate() {
        let color_ident = color_variant_ident(color_name);
        grid_items.push(quote! { super::Color::#color_ident.to_match_color() });
        first_seen_entries.entry(color_name).or_insert(idx);
    }

    let color_items: Vec<TokenStream> = first_seen_entries
        .into_iter()
        .map(|(color_name, idx)| {
            let color_ident = color_variant_ident(color_name);
            quote! { (super::Color::#color_ident.to_match_color(), #idx) }
        })
        .collect();

    quote! {
        {
            const WIDTH: usize = #width;
            const GRID: &[::tespat::MatchColor<super::Color>] = const {
                &[ #(#grid_items,)* ]
            };
            const COLORS: &[(::tespat::MatchColor<super::Color>, usize)] = const {
                &[ #(#color_items,)* ]
            };
            ::tespat::Pattern::from_static(WIDTH, GRID, COLORS)
        }
    }
}
