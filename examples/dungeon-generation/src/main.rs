use std::fs;

mod generate_paths;
mod generate_rooms;

// 引入 build.rs 生成的规则代码。
mod imports {
    // 引入路径生成规则。
    pub mod generate_paths {
        tespat::include_tespat!("patterns/generate_paths");
    }

    // 引入房间生成规则。
    pub mod generate_rooms {
        tespat::include_tespat!("patterns/generate_rooms");
    }
}

fn main() {
    let tespat = generate_rooms::generate(false, 17, 21);
    let mut tespat = tespat
        .migrate(generate_rooms::cast_color_for_output)
        .unwrap()
        .enable_history(true)
        .build();
    generate_paths::generate(&mut tespat);

    fs::write(
        format!(
            "{}/exported.json",
            std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default()
        ),
        tespat.export_history().to_editor_playback_file(),
    )
    .unwrap();
}
