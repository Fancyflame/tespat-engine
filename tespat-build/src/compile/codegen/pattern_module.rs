use std::collections::HashMap;

use anyhow::{anyhow, Result};
use proc_macro2::TokenStream;
use quote::quote;

use crate::compile::codegen::ident::{
    color_const_ident, module_ident, namespace_index, namespaced_color_variant_ident,
    pattern_static_ident,
};
use crate::compile::ir::{NamespaceNode, PatternConfig, ProjectFile};

/// 生成命名空间模块树。
pub(crate) fn generate_namespace_modules(project: &ProjectFile<'_>) -> Result<TokenStream> {
    generate_namespace_module(project, &project.root, true)
}

/// 递归生成单个命名空间模块。
fn generate_namespace_module(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
    is_root: bool,
) -> Result<TokenStream> {
    let color_module = generate_color_module(project, namespace)?;
    let unit_pattern_module = generate_unit_pattern_module(project, namespace)?;
    let pattern_module = generate_pattern_module(project, namespace)?;
    let children_module = generate_children_module(project, namespace)?;

    if is_root {
        Ok(quote! {
            #color_module
            #unit_pattern_module
            #pattern_module
            #children_module
        })
    } else {
        let module_name = module_ident(last_segment(&namespace.full_path));
        Ok(quote! {
            /// 子命名空间模块
            pub mod #module_name {
                pub use super::super::Color;
                #color_module
                #unit_pattern_module
                #pattern_module
                #children_module
            }
        })
    }
}

/// 生成子命名空间集合模块。
fn generate_children_module(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
) -> Result<TokenStream> {
    let children = namespace
        .children
        .iter()
        .map(|child| generate_namespace_module(project, child, false))
        .collect::<Result<Vec<_>>>()?;

    Ok(quote! {
        /// 子命名空间集合
        pub mod children {
            #(#children)*
        }
    })
}

/// 生成当前命名空间颜色别名模块。
fn generate_color_module(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
) -> Result<TokenStream> {
    let namespace_index = namespace_index(project, &namespace.full_path);
    let mut color_names: Vec<_> = namespace.palette.keys().copied().collect();
    color_names.sort();

    let color_items = color_names.into_iter().map(|color_name| {
        let const_ident = color_const_ident(color_name);
        let variant = namespaced_color_variant_ident(color_name, namespace_index);

        quote! {
            pub const #const_ident: super::Color = super::Color::#variant;
        }
    });

    Ok(quote! {
        /// 当前命名空间颜色别名。
        #[allow(non_upper_case_globals)]
        pub mod color {
            #(#color_items)*
        }
    })
}

/// 生成单元 pattern 模块。
fn generate_unit_pattern_module(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
) -> Result<TokenStream> {
    let namespace_index = namespace_index(project, &namespace.full_path);
    let mut color_names: Vec<_> = namespace.palette.keys().copied().collect();
    color_names.sort();

    let items = color_names.into_iter().map(|color_name| {
        let static_ident = pattern_static_ident(color_name);
        let variant = namespaced_color_variant_ident(color_name, namespace_index);

        quote! {
            pub static #static_ident: ::tespat::Pattern<super::Color> = {
                const WIDTH: usize = 1usize;
                const GRID: &[::tespat::MatchColor<super::Color>] = const {
                    &[super::Color::#variant.to_match_color()]
                };
                const COLORS: &[(::tespat::MatchColor<super::Color>, usize)] = const {
                    &[(super::Color::#variant.to_match_color(), 0usize)]
                };
                ::tespat::Pattern::from_static(WIDTH, GRID, COLORS)
            };
        }
    });

    Ok(quote! {
        #[allow(dead_code)]
        pub mod unit_pattern {
            #(#items)*
        }
    })
}

/// 生成当前命名空间的 pattern 集合模块。
fn generate_pattern_module(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
) -> Result<TokenStream> {
    let mut pattern_items = Vec::with_capacity(namespace.patterns.len());
    let mut pattern_names = HashMap::new();

    for (name, pattern) in &namespace.patterns {
        if pattern_names.insert(*name, ()).is_some() {
            return Err(anyhow!("pattern 重名: {}", name));
        }
        pattern_items.push(generate_pattern_pair_item(
            project, namespace, name, pattern,
        )?);
    }

    Ok(quote! {
        pub mod pattern {
            #(#pattern_items)*
        }
    })
}

/// 生成 capture/replace pattern 对应的静态项。
fn generate_pattern_pair_item(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
    name: &str,
    config: &PatternConfig<'_>,
) -> Result<TokenStream> {
    let capture = generate_pattern_expr(project, namespace, config.width, &config.capture)?;
    let replace = generate_pattern_expr(project, namespace, config.width, &config.replace)?;
    let static_name = pattern_static_ident(name);

    Ok(quote! {
        pub static #static_name: (
            ::tespat::Pattern<super::Color>,
            ::tespat::Pattern<super::Color>
        ) = (
            #capture,
            #replace,
        );
    })
}

/// 生成用于 static PATTERN 的表达式。
fn generate_pattern_expr(
    project: &ProjectFile<'_>,
    namespace: &NamespaceNode<'_>,
    width: usize,
    pattern: &[&str],
) -> Result<TokenStream> {
    let namespace_index = namespace_index(project, &namespace.full_path);
    let mut grid_items = Vec::with_capacity(pattern.len());
    let mut first_seen_entries: HashMap<&str, usize> = HashMap::new();

    for (idx, &color_name) in pattern.iter().enumerate() {
        if !namespace.palette.contains_key(color_name) {
            return Err(anyhow!(
                "命名空间 `{}` 中 pattern 引用了不存在的颜色 `{}`",
                namespace.path_display,
                color_name
            ));
        }

        let color_ident = namespaced_color_variant_ident(color_name, namespace_index);
        grid_items.push(quote! { super::Color::#color_ident.to_match_color() });
        first_seen_entries.entry(color_name).or_insert(idx);
    }

    let color_items: Vec<TokenStream> = first_seen_entries
        .into_iter()
        .map(|(color_name, idx)| {
            let color_ident = namespaced_color_variant_ident(color_name, namespace_index);
            quote! { (super::Color::#color_ident.to_match_color(), #idx) }
        })
        .collect();

    Ok(quote! {
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
    })
}

/// 获取命名空间路径的最后一段名称。
fn last_segment(path: &str) -> &str {
    path.rsplit('.').next().unwrap_or(path)
}
