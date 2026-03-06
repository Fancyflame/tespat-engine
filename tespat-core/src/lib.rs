pub use pattern::Pattern;
use std::{fmt::Debug, hash::Hash};

pub mod app;
mod layer;
pub mod pattern;

/// 可作为层中的数据的类型。请确保克隆该类型是廉价的，可能涉及大量克隆。
pub trait PatternColor: Hash + Eq + Clone + Debug + 'static {}

pub trait StrColor: PatternColor {
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

#[macro_export]
macro_rules! include_tespat {
    () => {
        include!(concat!(env!("OUT_DIR"), "/tespat_generated.rs"));
    };
}
