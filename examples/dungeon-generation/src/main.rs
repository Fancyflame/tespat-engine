use std::fs;

use tespat::include_tespat;

mod generate_paths;
mod generate_rooms;

include_tespat!();

fn main() {
    let tespat = generate_rooms::generate(false, 17, 21);
    let mut tespat = tespat.migrate().enable_history(false).build();
    generate_paths::generate(&mut tespat);

    fs::write(
        format!(
            "{}/exported.json",
            std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default()
        ),
        tespat.export_history().to_json(),
    )
    .unwrap();
}
