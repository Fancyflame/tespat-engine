use crate::{GraphColor, layer::Layer, pattern::transform::TransformedPattern};

impl<T: GraphColor> Layer<T> {
    /// 将给定位置作为左上角，将模式放在该位置上
    pub fn pattern_replace(
        &mut self,
        position: (usize, usize),
        replaced_by: TransformedPattern<T>,
    ) {
        let (left, top) = position;

        assert!(
            left + replaced_by.width() <= self.row_width
                && top + replaced_by.height() <= self.height(),
            "replace pattern will out of bound"
        );

        for ((x, y), replace) in replaced_by.iter() {
            let Some(replace) = replace else {
                continue;
            };

            let lx = left + x;
            let ly = top + y;

            self.mutate_color(lx + ly * self.row_width, replace.clone());
        }
    }
}
