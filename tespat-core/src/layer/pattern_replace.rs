use crate::{GraphColor, ReplaceColor, layer::Layer, pattern::transform::TransformedPattern};

impl<T: GraphColor> Layer<T> {
    /// 将给定位置作为左上角，将模式放在该位置上
    pub fn pattern_replace<P>(
        &mut self,
        position: (usize, usize),
        replaced_by: TransformedPattern<P>,
    ) where
        P: ReplaceColor<T>,
    {
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
            let index = lx + ly * self.row_width;
            let place_graph_color = &self.pixel_info_table[index].color;
            let replaced_color = replace.replace(place_graph_color, replaced_by.symmetry);

            self.mutate_color(index, replaced_color);
        }
    }
}
