fn main() {
    tespat_compiler::TespatCompiler::new()
        .include("./patterns", "imports")
        .compile()
        .unwrap();
}
