use tespat_build::TespatCompiler;

fn main() {
    TespatCompiler::new()
        .include("./city-layout.json")
        .compile()
        .unwrap();
}
