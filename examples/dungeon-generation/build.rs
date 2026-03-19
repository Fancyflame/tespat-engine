fn main() {
    tespat_compiler::TespatCompiler::new()
        .include("./patterns")
        .compile()
        .unwrap();
}
