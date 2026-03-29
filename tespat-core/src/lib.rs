pub use pattern::Pattern;
use std::{
    fmt::{Debug, Display},
    hash::Hash,
};

use crate::pattern::transform::Symmetry;

pub mod app;
pub mod color_direction;
mod layer;
pub mod pattern;

#[cfg(feature = "web-editor")]
pub mod web_editor;

#[macro_export]
macro_rules! include_tespat {
    ($relative_path:literal) => {
        include!(concat!(
            env!("OUT_DIR"),
            "/tespat_generated/",
            $relative_path,
            ".rs"
        ));
    };
}

/// 可作为层中的数据的类型。请确保克隆该类型是廉价的，可能涉及大量克隆。
pub trait GraphColor: Hash + Eq + Clone + Debug + 'static {}

/// 固定颜色，可同时用于捕获（包括索引）和替换
pub trait StaticColor<T: GraphColor> {
    fn get_color_with_symmetry(&self, symmetry: Symmetry) -> T;
}

/// 用于捕获
pub trait CaptureColor<T: GraphColor> {
    fn as_index(&self, symmetry: Symmetry) -> Option<T>;
    fn matches(&self, graph_color: &T, symmetry: Symmetry) -> bool;
}

/// 用于替换
pub trait ReplaceColor<T: GraphColor> {
    fn replace(&self, place_graph_color: &T, symmetry: Symmetry) -> T;
}

impl<T, C> CaptureColor<C> for T
where
    T: StaticColor<C>,
    C: GraphColor,
{
    fn as_index(&self, symmetry: Symmetry) -> Option<C> {
        Some(self.get_color_with_symmetry(symmetry))
    }
    fn matches(&self, graph_color: &C, symmetry: Symmetry) -> bool {
        self.get_color_with_symmetry(symmetry) == *graph_color
    }
}

impl<T, C> ReplaceColor<C> for T
where
    T: StaticColor<C>,
    C: GraphColor,
{
    fn replace(&self, _place_graph_color: &C, symmetry: Symmetry) -> C {
        self.get_color_with_symmetry(symmetry)
    }
}

pub trait StrColor: GraphColor {
    fn to_str(&self) -> &'static str;
}

fn index_to_position(index: usize, row_width: usize) -> (usize, usize) {
    if row_width == 0 {
        assert_eq!(index, 0);
        (0, 0)
    } else {
        (index % row_width, index / row_width)
    }
}

#[derive(Debug)]
pub struct ParseStrToColorError {
    pub string: Option<String>,
}

impl ParseStrToColorError {
    pub fn from_str(s: &str) -> Self {
        Self {
            string: Some(s.to_string()),
        }
    }
}

impl Display for ParseStrToColorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.string {
            Some(s) => write!(f, "cannot parse string {s:?} to specified color"),
            None => write!(f, "cannot parse string to specified color"),
        }
    }
}
