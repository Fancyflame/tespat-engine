use State::*;
use tespat_runtime::{
    Color,
    app::{CreateTespat, Tespat},
    pattern::Pattern,
};

#[derive(Hash, PartialEq, Eq, Clone, Copy, Debug)]
enum State {
    Empty,
    Stone,
    Gold,
}

impl Color for State {}

#[rustfmt::skip]
fn main() {
    #[rustfmt::skip]
    let (init, stone_match, stone_replc, melt_match, melt_replc) = (
        [
            Empty, Stone, Empty, Empty,
            Stone, Stone, Stone, Empty,
            Empty, Stone, Stone, Empty,
            Empty, Empty, Empty, Stone,
        ],
        Pattern::literal([
            [None,        Some(Stone), None       ],
            [Some(Stone), Some(Stone), Some(Stone)],
            [None,        Some(Stone), None       ],
        ]),
        Pattern::literal([
            [None,        Some(Stone), None       ],
            [Some(Stone), Some(Gold),  Some(Stone)],
            [None,        Some(Stone), None       ],
        ]),
        Pattern::literal([
            [None,        Some(Stone), None       ],
            [Some(Stone), Some(Gold),  Some(Stone)],
            [None,        Some(Stone), None       ],
        ]),
        Pattern::literal([
            [None,        Some(Empty), None       ],
            [Some(Empty), Some(Gold),  Some(Empty)],
            [None,        Some(Empty), None       ],
        ]),
    );

    let mut tespat = Tespat::new(CreateTespat {
        picture: init.into_iter(),
        width: 4,
        enable_history: false,
    });

    loop {
        if let Some(m) = tespat.capture(&melt_match).optioned() {
            tespat.replace(&m, &melt_replc);
            continue;
        }
        
        if let Some(m) = tespat.capture(&stone_match).optioned() {
            tespat.replace(&m, &stone_replc);
            continue;
        }

        break;
    }

    dbg!(tespat.export_to_2d_array::<4, 4>().unwrap());
}
