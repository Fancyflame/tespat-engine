use crate::{PatternColor, layer::Layer};

pub(super) fn capture_frame<T: PatternColor>(layer: &Layer<T>) -> Vec<T> {
    layer.export()
}
