pub mod storage;

#[cfg(feature = "desktop")]
mod desktop {
    use super::storage::{self, Change, Library, Row};
    use std::{path::PathBuf, sync::Mutex};
    use tauri::{Manager, State};

    struct LibraryState {
        root: PathBuf,
        library: Mutex<Option<Library>>,
    }
    impl LibraryState {
        fn access<T>(
            &self,
            run: impl FnOnce(&mut Library) -> storage::Result<T>,
        ) -> storage::Result<T> {
            let mut guard = self
                .library
                .lock()
                .map_err(|_| "Local storage is unavailable. Restart Study Room.")?;
            if guard.is_none() {
                *guard = Some(Library::open(&self.root)?);
            }
            run(guard.as_mut().unwrap())
        }
    }
    #[tauri::command]
    async fn load_library(state: State<'_, LibraryState>) -> storage::Result<Vec<Row>> {
        state.access(|db| db.load())
    }
    #[tauri::command]
    async fn commit_library(
        state: State<'_, LibraryState>,
        changes: Vec<Change>,
    ) -> storage::Result<Vec<Row>> {
        state.access(|db| db.commit(changes))
    }
    #[tauri::command]
    async fn read_pdf(state: State<'_, LibraryState>, key: String) -> storage::Result<String> {
        state.access(|db| db.read_pdf(&key))
    }
    #[tauri::command]
    fn storage_location(state: State<'_, LibraryState>) -> String {
        state.root.to_string_lossy().into_owned()
    }
    #[tauri::command]
    async fn save_backup(path: PathBuf, data: String) -> storage::Result<()> {
        storage::save_backup(&path, &data)
    }

    pub fn run() {
        let mut context = tauri::generate_context!();
        // CI must opt in explicitly. Ordinary installed launches keep developer
        // tools and remote debugging disabled, as defined in tauri.conf.json.
        #[cfg(target_os = "windows")]
        if std::env::var("STUDY_ROOM_VERIFY_WEBVIEW").as_deref() == Ok("1") {
            for window in &mut context.config_mut().app.windows {
                window.additional_browser_args = Some("--remote-debugging-port=9222".into());
                window.devtools = Some(true);
                window.data_directory =
                    Some(std::env::temp_dir().join("study-room-verification-webview"));
            }
        }
        tauri::Builder::default()
            .plugin(tauri_plugin_single_instance::init(|app, _, _| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }))
            .plugin(tauri_plugin_dialog::init())
            .setup(|app| {
                let root = app.path().app_local_data_dir()?;
                app.manage(LibraryState {
                    root,
                    library: Mutex::new(None),
                });
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                load_library,
                commit_library,
                read_pdf,
                storage_location,
                save_backup
            ])
            .run(context)
            .expect("Could not start Study Room");
    }
}
#[cfg(feature = "desktop")]
pub use desktop::run;
