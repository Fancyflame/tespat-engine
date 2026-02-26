use State::*;
use tespat_runtime::{
    Color,
    app::{CreateTespat, Tespat},
    pattern::Pattern,
};

#[derive(Hash, PartialEq, Eq, Clone, Copy, Debug)]
enum State {
    Empty,
    Slime,
    Apple,
    SatiatedSlime,
}

impl Color for State {}

#[rustfmt::skip]
fn main() {
    #[rustfmt::skip]
    let (init, move_match, move_replc, eat_match, eat_replc) = (
        [
            Empty, Empty, Empty, Empty, Empty,
            Empty, Slime, Empty, Apple, Empty,
            Empty, Empty, Empty, Empty, Empty,
            Empty, Empty, Empty, Empty, Empty,
            Empty, Empty, Empty, Empty, Empty,
        ],
        Pattern::literal([
            [Some(Slime), Some(Apple)]
        ]),
        Pattern::literal([
            [Some(Empty), Some(SatiatedSlime)]
        ]),
        Pattern::literal([
            [Some(Slime), Some(Empty)]
        ]),
        Pattern::literal([
            [Some(Empty), Some(Slime)]
        ]),
    );

    let mut tespat = Tespat::new(CreateTespat {
        picture: init.into_iter(),
        width: 5,
        enable_history: false,
    });

    loop {
        if let Some(m) = tespat.capture(&eat_match).optioned() {
            tespat.replace(&m, &eat_replc);
            continue;
        }
        
        if let Some(m) = tespat.capture(&move_match).optioned() {
            tespat.replace(&m, &move_replc);
            continue;
        }

        break;
    }

    dbg!(tespat.export_to_2d_array::<5, 5>().unwrap());
}
