use crate::{Color, layer::Layer, pattern::Pattern};

impl<T: Color> Layer<T> {
    pub fn pattern_replace(&mut self, position: (usize, usize), replaced_by: &Pattern<T>) {
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
