use proc_macro::TokenStream;

mod enum_filter;

/// 为标注的 enum 生成筛选式 `TryFrom` 实现。
#[proc_macro_attribute]
pub fn enum_filter(attr: TokenStream, item: TokenStream) -> TokenStream {
    enum_filter::expand(attr, item)
}
