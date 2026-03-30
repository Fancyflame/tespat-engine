fn main() {
    tespat_build::TespatCompiler::new()
        .include("slime_eat_apple.json")
        .compile()
        .unwrap();
}
