use std::collections::HashMap;

use anyhow::{Result, bail};
use proc_macro2::Ident;
use serde::Deserialize;

use crate::compile::codegen::ident::namespaced_color_variant_ident;
use crate::compile::json::{
    NamedPatternConfig, RecursiveNamespaceChildProjectFile, RecursiveNamespaceProjectFile,
};

/// 内部统一项目结构
pub(crate) struct ProjectFile<'a> {
    pub root: NamespaceNode<'a>,
    pub colors: Vec<ColorVariant<'a>>,
    pub visible_colors_by_namespace: HashMap<String, Vec<VisibleColor<'a>>>,
}

/// 递归命名空间节点
pub(crate) struct NamespaceNode<'a> {
    pub full_path: String,
    pub path_display: String,
    pub palette: HashMap<&'a str, PaletteConfig<'a>>,
    pub patterns: Vec<(&'a str, PatternConfig<'a>)>,
    pub children: Vec<NamespaceNode<'a>>,
}

/// 统一根颜色枚举中的单个颜色定义
pub(crate) struct ColorVariant<'a> {
    pub variant_ident: Ident,
    pub raw_name: &'a str,
    pub debug_name: String,
    pub editor_color: &'a str,
    pub icon: Option<&'a str>,
    pub namespace_path: String,
}

/// 命名空间解析后的可见颜色条目
pub(crate) struct VisibleColor<'a> {
    pub raw_name: &'a str,
    pub variant_ident: Ident,
}

#[derive(Deserialize)]
pub(crate) struct PaletteConfig<'a> {
    #[serde(borrow)]
    pub color: &'a str,
    #[serde(borrow)]
    pub icon: Option<&'a str>,
    #[serde(default)]
    pub public: bool,
}

#[derive(Deserialize, Clone)]
pub(crate) struct PatternConfig<'a> {
    pub width: usize,
    #[serde(borrow)]
    pub capture: Vec<&'a str>,
    #[serde(borrow)]
    pub replace: Vec<&'a str>,
}

impl<'a> ProjectFile<'a> {
    /// 从 JSON 结构构建中间层项目表示。
    pub fn from_json(recursive: RecursiveNamespaceProjectFile<'a>) -> Result<Self> {
        let root = build_recursive_root_node(recursive)?;

        let mut namespace_indices = HashMap::new();
        let mut colors = Vec::new();
        collect_color_variants(&root, &mut namespace_indices, &mut colors);
        let visible_colors_by_namespace =
            collect_visible_colors_by_namespace(&root, &colors);

        Ok(Self {
            root,
            colors,
            visible_colors_by_namespace,
        })
    }
}

/// 构建根命名空间节点。
fn build_recursive_root_node<'a>(
    root: RecursiveNamespaceProjectFile<'a>,
) -> Result<NamespaceNode<'a>> {
    Ok(NamespaceNode {
        full_path: String::new(),
        path_display: ".".to_string(),
        palette: root.palette,
        patterns: named_patterns_to_vec(root.patterns)?,
        children: root
            .children
            .into_iter()
            .map(|child| build_recursive_child_node("", child))
            .collect::<Result<Vec<_>>>()?,
    })
}

/// 构建子命名空间节点。
fn build_recursive_child_node<'a>(
    parent_path: &str,
    node: RecursiveNamespaceChildProjectFile<'a>,
) -> Result<NamespaceNode<'a>> {
    if node.name.trim().is_empty() {
        bail!("children 中存在空命名空间名");
    }

    let full_path = if parent_path.is_empty() {
        node.name.to_string()
    } else {
        format!("{parent_path}.{}", node.name)
    };

    Ok(NamespaceNode {
        full_path: full_path.clone(),
        path_display: full_path.clone(),
        palette: node.palette,
        patterns: named_patterns_to_vec(node.patterns)?,
        children: node
            .children
            .into_iter()
            .map(|child| build_recursive_child_node(&full_path, child))
            .collect::<Result<Vec<_>>>()?,
    })
}

/// 将具名 pattern 列表转换为中间层形式并检查重名。
fn named_patterns_to_vec<'a>(
    patterns: Vec<NamedPatternConfig<'a>>,
) -> Result<Vec<(&'a str, PatternConfig<'a>)>> {
    let mut seen = HashMap::new();
    let mut result = Vec::with_capacity(patterns.len());
    for pattern in patterns {
        if seen.insert(pattern.name, ()).is_some() {
            bail!("pattern 重名: {}", pattern.name);
        }
        result.push((pattern.name, pattern.config));
    }
    Ok(result)
}

/// 收集所有命名空间颜色，生成根颜色枚举所需数据。
fn collect_color_variants<'a>(
    node: &NamespaceNode<'a>,
    namespace_indices: &mut HashMap<String, usize>,
    colors: &mut Vec<ColorVariant<'a>>,
) {
    let namespace_index = namespace_indices.len();
    namespace_indices.insert(node.full_path.clone(), namespace_index);

    let mut color_names: Vec<_> = node.palette.keys().copied().collect();
    color_names.sort();

    for color_name in color_names {
        let variant_ident = namespaced_color_variant_ident(color_name, namespace_index);
        let palette = node
            .palette
            .get(color_name)
            .expect("palette entry should exist for collected color");
        let debug_name = if node.path_display == "." {
            format!(".{color_name}")
        } else {
            format!("{}.{}", node.path_display, color_name)
        };

        colors.push(ColorVariant {
            variant_ident,
            raw_name: color_name,
            debug_name,
            editor_color: palette.color,
            icon: palette.icon,
            namespace_path: node.full_path.clone(),
        });
    }

    for child in &node.children {
        collect_color_variants(child, namespace_indices, colors);
    }
}

/// 收集每个命名空间可见颜色（本地 + 父链 public 继承）。
fn collect_visible_colors_by_namespace<'a>(
    root: &NamespaceNode<'a>,
    colors: &[ColorVariant<'a>],
) -> HashMap<String, Vec<VisibleColor<'a>>> {
    let mut local_variant_map: HashMap<(String, &'a str), Ident> = HashMap::new();
    for color in colors {
        local_variant_map.insert(
            (color.namespace_path.clone(), color.raw_name),
            color.variant_ident.clone(),
        );
    }

    let mut local_palette_by_namespace: HashMap<String, Vec<LocalPaletteEntry<'a>>> =
        HashMap::new();
    collect_local_palette_entries(root, &mut local_palette_by_namespace);

    let mut namespace_paths: Vec<_> = local_palette_by_namespace.keys().cloned().collect();
    namespace_paths.sort();

    let mut result = HashMap::new();
    for namespace_path in namespace_paths {
        let mut visible_sources: HashMap<&'a str, String> = HashMap::new();

        if let Some(local_entries) = local_palette_by_namespace.get(&namespace_path) {
            for entry in local_entries {
                visible_sources.insert(entry.raw_name, namespace_path.clone());
            }
        }

        let mut parent_path = parent_namespace_path(&namespace_path);
        while let Some(path) = parent_path {
            if let Some(parent_entries) = local_palette_by_namespace.get(&path) {
                for entry in parent_entries {
                    if !entry.public || visible_sources.contains_key(entry.raw_name) {
                        continue;
                    }
                    visible_sources.insert(entry.raw_name, path.clone());
                }
            }
            parent_path = parent_namespace_path(&path);
        }

        let mut names: Vec<_> = visible_sources.keys().copied().collect();
        names.sort();

        let visible = names
            .into_iter()
            .map(|name| {
                let source_path = visible_sources
                    .get(name)
                    .expect("visible source should exist for color");
                let variant_ident = local_variant_map
                    .get(&(source_path.clone(), name))
                    .expect("visible color should map to a local variant")
                    .clone();
                VisibleColor {
                    raw_name: name,
                    variant_ident,
                }
            })
            .collect();

        result.insert(namespace_path, visible);
    }

    result
}

/// 命名空间本地颜色条目快照。
struct LocalPaletteEntry<'a> {
    raw_name: &'a str,
    public: bool,
}

/// 递归收集每个命名空间的本地颜色条目。
fn collect_local_palette_entries<'a>(
    node: &NamespaceNode<'a>,
    result: &mut HashMap<String, Vec<LocalPaletteEntry<'a>>>,
) {
    let mut entries = node
        .palette
        .iter()
        .map(|(&name, palette)| LocalPaletteEntry {
            raw_name: name,
            public: palette.public,
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.raw_name);
    result.insert(node.full_path.clone(), entries);

    for child in &node.children {
        collect_local_palette_entries(child, result);
    }
}

/// 计算命名空间父路径。
fn parent_namespace_path(path: &str) -> Option<String> {
    if path.is_empty() {
        return None;
    }
    path.rfind('.').map_or_else(
        || Some(String::new()),
        |idx| Some(path[..idx].to_string()),
    )
}
