use convert_case::Case;
use proc_macro2::Ident;
use quote::format_ident;

use crate::compile::ir::ProjectFile;

/// 生成带命名空间索引后缀的颜色枚举项标识符。
pub(crate) fn namespaced_color_variant_ident(name: &str, namespace_index: usize) -> Ident {
    let mut ident = sanitize_ident(name);
    ident = convert_case::Casing::to_case(&ident, Case::Pascal);
    if ident.is_empty() {
        ident.push('_');
    }
    if ident.chars().all(|c| c == '_') {
        ident.push('_');
    }
    ident.push('_');
    ident.push_str(&namespace_index.to_string());
    format_ident!("{ident}")
}

/// 生成模块标识符。
pub(crate) fn module_ident(name: &str) -> Ident {
    cased_ident(name, Case::Snake)
}

/// 生成 ColorMap 字段标识符。
pub(crate) fn color_map_field_ident(name: &str) -> Ident {
    cased_ident(name, Case::Snake)
}

/// 生成 pattern 静态项标识符。
pub(crate) fn pattern_static_ident(name: &str) -> Ident {
    cased_ident(name, Case::UpperSnake)
}

/// 生成颜色常量标识符。
pub(crate) fn color_const_ident(name: &str) -> Ident {
    cased_ident(name, Case::Pascal)
}

/// 查询命名空间在全局颜色表中的索引。
pub(crate) fn namespace_index<'a>(project: &ProjectFile<'a>, path: &str) -> usize {
    *project
        .namespace_indices
        .get(path)
        .expect("namespace index should exist for generated namespace")
}

/// 保留下划线前缀进行 case 转换。
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

/// 名称限制：只允许字母、数字和下划线。
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
