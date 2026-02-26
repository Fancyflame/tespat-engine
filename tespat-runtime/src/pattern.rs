use crate::{Color, index_to_position};

pub struct Pattern<T> {
    width: usize,
    grid: Vec<Option<T>>,
}

impl<T: Color> Pattern<T> {
    pub fn new(width: usize, grid: Vec<Option<T>>) -> Self {
        assert!(
            if width == 0 {
                grid.len() == 0
            } else {
                grid.len() % width == 0
            },
            "Length of `grid` must be an integer multiple of `width`"
        );
        Self { width, grid }
    }

    pub fn literal<const W: usize, const H: usize>(grid: [[Option<T>; W]; H]) -> Self {
        Self::new(
            W,
            grid.into_iter().flat_map(|arr| arr.into_iter()).collect(),
        )
    }
}

impl<T> Pattern<T> {
    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.grid.len() / self.width
    }

    pub fn grid(&self) -> &Vec<Option<T>> {
        &self.grid
    }

    pub fn iter(&self) -> impl Iterator<Item = ((usize, usize), &Option<T>)> {
        self.grid
            .iter()
            .enumerate()
            .map(|(i, color)| (index_to_position(i, self.width), color))
    }
}
