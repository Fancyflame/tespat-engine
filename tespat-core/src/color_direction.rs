#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Direction {
    Up,
    Left,
    Down,
    Right,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Rotation {
    Id,
    CCW90,
    Flip,
    CW90,
}

impl Direction {
    pub const fn rotate(self, rotation: Rotation) -> Self {
        const ARRAY: [Direction; 4] = [
            Direction::Up,
            Direction::Left,
            Direction::Down,
            Direction::Right,
        ];

        let mut index = match self {
            Self::Up => 0,
            Self::Left => 1,
            Self::Down => 2,
            Self::Right => 3,
        };

        index += match rotation {
            Rotation::Id => 0,
            Rotation::CCW90 => 1,
            Rotation::Flip => 2,
            Rotation::CW90 => 3,
        };

        ARRAY[index % 4]
    }
}
