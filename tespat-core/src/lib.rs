pub use pattern::Pattern;
use std::{fmt::Debug, hash::Hash};

use crate::color_direction::Rotation;

pub mod app;
pub mod color_direction;
mod layer;
pub mod pattern;

#[macro_export]
macro_rules! include_tespat {
    () => {
        include!(concat!(env!("OUT_DIR"), "/tespat_generated.rs"));
    };
}

/// 可作为层中的数据的类型。请确保克隆该类型是廉价的，可能涉及大量克隆。
pub trait GraphColor: Hash + Eq + Clone + Debug + 'static {}

/// 固定颜色，可同时用于捕获（包括索引）和替换
pub trait ConstantColor<T: GraphColor> {
    fn get_color_with_rotation(&self, rotation: Rotation) -> T;
}

impl<T, C> CaptureColor<C> for T
where
    T: ConstantColor<C>,
    C: GraphColor,
{
    fn as_index(&self, rotation: Rotation) -> Option<C> {
        Some(self.get_color_with_rotation(rotation))
    }
    fn matches(&self, graph_color: &C, rotation: Rotation) -> bool {
        self.get_color_with_rotation(rotation) == *graph_color
    }
}

impl<T, C> ReplaceColor<C> for T
where
    T: ConstantColor<C>,
    C: GraphColor,
{
    fn replace(&self, _place_graph_color: &C, rotation: Rotation) -> C {
        self.get_color_with_rotation(rotation)
    }
}

/// 用于捕获
pub trait CaptureColor<T: GraphColor> {
    fn as_index(&self, rotation: Rotation) -> Option<T>;
    fn matches(&self, graph_color: &T, rotation: Rotation) -> bool;
}

/// 用于替换
pub trait ReplaceColor<T: GraphColor> {
    fn replace(&self, place_graph_color: &T, rotation: Rotation) -> T;
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
