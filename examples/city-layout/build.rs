use tespat_compiler::TespatCompiler;

fn main() {
    TespatCompiler::new()
        .include("./city-layout.json", "example")
        .compile()
        .unwrap();
}
