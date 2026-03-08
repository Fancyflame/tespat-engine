use tespat::{
    app::MatchFilter,
    include_tespat,
    pattern::transform::{Symmetry, SymmetryList},
};

include_tespat!();

fn main() {
    use example::pattern;
    let mut tespat = pattern::GRAPH
        .clone()
        .create_tespat()
        .unwrap()
        .enable_history(true)
        .create();

    loop {
        if tespat.execute(
            &pattern::EAT_APPLE_MATCH,
            &pattern::EAT_APPLE_REPLACE,
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(
            &pattern::SLIME_MOVE_MATCH,
            &pattern::SLIME_MOVE_REPLACE,
            MatchFilter::One,
            SymmetryList {
                rot_90: true,
                ..SymmetryList::ID
            },
        ) {
            continue;
        }

        break;
    }

    std::fs::write("exported.json", tespat.export_history().to_json()).unwrap();
}
