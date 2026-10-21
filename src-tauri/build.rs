fn main() {
    println!("cargo:rerun-if-env-changed=STUDY_ROOM_UPDATER_PUBLIC_KEY");
    #[cfg(feature = "desktop")]
    tauri_build::build();
}
