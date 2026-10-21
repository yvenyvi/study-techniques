// Test-only stdin/stdout bridge: exercises the same storage code as Tauri.
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use study_room_lib::storage::{self, Library};
fn main() {
    let root = std::env::args().nth(1).expect("test library folder");
    let mut library = Library::open(&root).expect("open test library");
    for line in io::stdin().lock().lines() {
        let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
        let args = &request["args"];
        let result: Result<Value, String> = (|| match request["command"].as_str().unwrap() {
            "load_library" => library
                .load()
                .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string())),
            "commit_library" => {
                let changes =
                    serde_json::from_value(args["changes"].clone()).map_err(|e| e.to_string())?;
                library
                    .commit(changes)
                    .and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
            }
            "read_pdf" => library
                .read_pdf(args["key"].as_str().unwrap_or(""))
                .map(Value::String),
            "storage_location" => Ok(Value::String(root.clone())),
            "save_backup" => storage::save_backup(
                std::path::Path::new(args["path"].as_str().unwrap()),
                args["data"].as_str().unwrap(),
            )
            .map(|_| Value::Null),
            "reopen" => {
                library = Library::open(&root)?;
                Ok(Value::Null)
            }
            _ => Err("Unknown test command".into()),
        })();
        let response = match result {
            Ok(result) => json!({"id":request["id"],"result":result}),
            Err(error) => json!({"id":request["id"],"error":error}),
        };
        println!("{response}");
        io::stdout().flush().unwrap();
    }
}
