fn main() {
    tespat_build::TespatCompiler::new()
        .include("./patterns")
        .compile()
        .unwrap();
}
