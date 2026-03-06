use tespat::include_tespat;

include_tespat!();

#[rustfmt::skip]
fn main() {
    use example::pattern;
    let mut tespat = pattern::GRAPH.clone().create_tespat().unwrap().enable_history(true).create();

    loop {
        if let Some(m) = tespat.capture(&pattern::EAT_APPLE_MATCH).optioned() {
            tespat.replace(&m, &pattern::EAT_APPLE_REPLACE);
            continue;
        }
        
        if let Some(m) = tespat.capture(&pattern::SLIME_MOVE_MATCH).optioned() {
            tespat.replace(&m, &pattern::SLIME_MOVE_REPLACE);
            continue;
        }

        break;
    }

    std::fs::write("exported.json", tespat.export_history().to_json()).unwrap();
    
    // dbg!(tespat.export_to_2d_array::<5, 4>().unwrap());
}
