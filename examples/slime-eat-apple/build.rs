fn main() {
    tespat_compiler::TespatCompiler::new()
        .include("slime_eat_apple.json", "example")
        .compile()
        .unwrap();
}
