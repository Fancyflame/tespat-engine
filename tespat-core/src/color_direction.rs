use crate::pattern::transform::Symmetry;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Direction {
    Up,
    Left,
    Down,
    Right,
}

impl Direction {
    pub const fn rotate(self, sym: Symmetry) -> Self {
        use Direction::*;

        match sym {
            Symmetry::Id => self,
            Symmetry::Rot90 => match self {
                Up => Left,
                Right => Up,
                Down => Right,
                Left => Down,
            },
            Symmetry::Rot180 => match self {
                Up => Down,
                Right => Left,
                Down => Up,
                Left => Right,
            },
            Symmetry::Rot270 => match self {
                Up => Right,
                Right => Down,
                Down => Left,
                Left => Up,
            },
            Symmetry::FlipH => match self {
                Up => Up,
                Right => Left,
                Down => Down,
                Left => Right,
            },
            Symmetry::FlipV => match self {
                Up => Down,
                Right => Right,
                Down => Up,
                Left => Left,
            },
            Symmetry::FlipD1 => match self {
                Up => Left,
                Right => Down,
                Down => Right,
                Left => Up,
            },
            Symmetry::FlipD2 => match self {
                Up => Right,
                Right => Up,
                Down => Left,
                Left => Down,
            },
        }
    }
}
