use tespat_runtime::{PatternColor, include_tespat};

include_tespat!();

#[rustfmt::skip]
fn main() {
    use example::pattern;
    let mut tespat = pattern::graph().create_tespat().unwrap().create();
    let eat_apple_match = pattern::eat_apple_match();
    let eat_apple_replace = pattern::eat_apple_replace();
    let slime_move_match = pattern::slime_move_match();
    let slime_move_replace = pattern::slime_move_replace();

    loop {
        if let Some(m) = tespat.capture(&eat_apple_match).optioned() {
            tespat.replace(&m, &eat_apple_replace);
            continue;
        }
        
        if let Some(m) = tespat.capture(&slime_move_match).optioned() {
            tespat.replace(&m, &slime_move_replace);
            continue;
        }

        break;
    }

    dbg!(tespat.export_to_2d_array::<5, 4>().unwrap());
}
