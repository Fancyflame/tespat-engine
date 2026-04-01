use crate::{GraphColor, StaticColor, pattern::transform::Symmetry};

#[derive(Clone, Copy, Hash, PartialEq, Eq, Debug)]
pub struct DirectionalColor<T> {
    pub kind: T,
    pub direction: Option<Direction>,
}

impl<T: GraphColor> GraphColor for DirectionalColor<T> {}

impl<T, C> StaticColor<DirectionalColor<C>> for DirectionalColor<T>
where
    T: GraphColor,
    C: GraphColor + From<T>,
{
    fn get_color_with_symmetry(&self, symmetry: Symmetry) -> DirectionalColor<C> {
        DirectionalColor {
            direction: self.direction.map(|d| d.rotate(symmetry)),
            kind: C::from(self.kind.clone()),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Direction {
    Up = 0,
    Left,
    Down,
    Right,
}

impl Direction {
    pub const fn rotate(self, sym: Symmetry) -> Self {
        use Direction::*;

        match sym {
            Symmetry::Id => self,
            Symmetry::CCW90 => match self {
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
            Symmetry::CW90 => match self {
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
