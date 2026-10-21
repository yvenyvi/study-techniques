use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub type Result<T> = std::result::Result<T, String>;
const TABLES: &[&str] = &[
    "courses",
    "documents",
    "notes",
    "reviewers",
    "goals",
    "sessions",
    "timers",
    "settings",
];
const PDF_LIMIT: usize = 50 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub table: String,
    pub data: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_key: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct Change {
    pub table: String,
    pub id: String,
    pub kind: String,
    pub data: Option<Value>,
    pub pdf: Option<String>,
}
pub struct Library {
    connection: Connection,
    root: PathBuf,
}
impl Library {
    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().to_path_buf();
        fs::create_dir_all(root.join("pdfs")).map_err(err)?;
        let connection = Connection::open(root.join("study-room.sqlite3")).map_err(err)?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(err)?;
        let version: u32 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(err)?;
        if version > 1 {
            return Err(
                "This library was created by a newer Study Room. Update the app to open it.".into(),
            );
        }
        connection
            .execute_batch(
                "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
             BEGIN IMMEDIATE;
             CREATE TABLE IF NOT EXISTS records (
                table_name TEXT NOT NULL,
                id TEXT NOT NULL,
                data TEXT NOT NULL CHECK(json_valid(data)),
                pdf_key TEXT,
                PRIMARY KEY(table_name, id)
             );
             PRAGMA user_version=1; COMMIT;",
            )
            .map_err(err)?;
        let library = Self { connection, root };
        library.cleanup_orphans()?;
        Ok(library)
    }
    pub fn root(&self) -> &Path {
        &self.root
    }
    pub fn load(&self) -> Result<Vec<Row>> {
        let mut statement = self
            .connection
            .prepare("SELECT table_name, data, pdf_key FROM records ORDER BY table_name, id")
            .map_err(err)?;
        let items = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })
            .map_err(err)?;
        items
            .map(|item| {
                let (table, data, pdf_key) = item.map_err(err)?;
                if !TABLES.contains(&table.as_str()) {
                    return Err("Unsupported library table.".into());
                }
                Ok(Row {
                    table,
                    data: serde_json::from_str(&data).map_err(err)?,
                    pdf_key,
                })
            })
            .collect()
    }
    pub fn read_pdf(&self, key: &str) -> Result<String> {
        validate_key(key)?;
        let bytes = fs::read(self.root.join("pdfs").join(format!("{key}.pdf"))).map_err(err)?;
        if bytes.len() > PDF_LIMIT {
            return Err("PDF exceeds 50 MB.".into());
        }
        Ok(STANDARD.encode(bytes))
    }
    pub fn commit(&mut self, changes: Vec<Change>) -> Result<Vec<Row>> {
        // All file writes are durable before SQLite can reference them. A crash
        // before SQL commit leaves only unreferenced files, removed on next open.
        let root = self.root.clone();
        let tx = self.connection.transaction().map_err(err)?;
        let outcome = (|| -> Result<()> {
            for change in changes {
                if !TABLES.contains(&change.table.as_str())
                    || change.id.is_empty()
                    || change.id.len() > 512
                {
                    return Err("Invalid study record.".into());
                }
                if change.kind == "delete" {
                    tx.execute(
                        "DELETE FROM records WHERE table_name=?1 AND id=?2",
                        params![change.table, change.id],
                    )
                    .map_err(err)?;
                    continue;
                }
                if change.kind != "add" && change.kind != "put" {
                    return Err("Invalid study operation.".into());
                }
                let data = change.data.ok_or("Missing study record.")?;
                if !data.is_object() || data.get("id").and_then(Value::as_str) != Some(&change.id) {
                    return Err("Invalid study record ID.".into());
                }
                let mut key: Option<String> = tx
                    .query_row(
                        "SELECT pdf_key FROM records WHERE table_name=?1 AND id=?2",
                        params![change.table, change.id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(err)?
                    .flatten();
                if let Some(pdf) = change.pdf {
                    if change.table != "documents" || pdf.len() > (PDF_LIMIT + 2) / 3 * 4 {
                        return Err("Invalid PDF size or table.".into());
                    }
                    let bytes = STANDARD.decode(pdf).map_err(err)?;
                    if bytes.len() > PDF_LIMIT
                        || !bytes[..bytes.len().min(1024)]
                            .windows(5)
                            .any(|v| v == b"%PDF-")
                    {
                        return Err("Invalid PDF file.".into());
                    }
                    let hash = format!("{:x}", Sha256::digest(&bytes));
                    let target = root.join("pdfs").join(format!("{hash}.pdf"));
                    if !target.exists() {
                        let mut temp =
                            tempfile::NamedTempFile::new_in(root.join("pdfs")).map_err(err)?;
                        temp.write_all(&bytes).map_err(err)?;
                        temp.as_file().sync_all().map_err(err)?;
                        temp.persist(&target).map_err(err)?;
                        #[cfg(unix)]
                        fs::File::open(root.join("pdfs"))
                            .and_then(|f| f.sync_all())
                            .map_err(err)?;
                    }
                    key = Some(hash);
                }
                if change.table == "documents" && key.is_none() {
                    return Err("The document has no PDF file.".into());
                }
                let sql = if change.kind == "add" {
                    "INSERT INTO records(table_name,id,data,pdf_key) VALUES (?1,?2,?3,?4)"
                } else {
                    "INSERT INTO records(table_name,id,data,pdf_key) VALUES (?1,?2,?3,?4) ON CONFLICT(table_name,id) DO UPDATE SET data=excluded.data,pdf_key=excluded.pdf_key"
                };
                tx.execute(sql, params![change.table, change.id, data.to_string(), key])
                    .map_err(err)?;
            }
            Ok(())
        })();
        match outcome {
            Ok(()) => tx.commit().map_err(err)?,
            Err(error) => {
                drop(tx);
                let _ = self.cleanup_orphans();
                return Err(error);
            }
        }
        // Disk cleanup failure must not turn a successful commit into a failed
        // save in the UI. Retry cleanup at the next library open.
        let _ = self.cleanup_orphans();
        self.load()
    }
    fn cleanup_orphans(&self) -> Result<()> {
        let keys: HashSet<String> = self
            .load()?
            .into_iter()
            .filter_map(|r| r.pdf_key)
            .map(|k| format!("{k}.pdf"))
            .collect();
        for entry in fs::read_dir(self.root.join("pdfs")).map_err(err)? {
            let entry = entry.map_err(err)?;
            if entry.file_type().map_err(err)?.is_file()
                && !keys.contains(&entry.file_name().to_string_lossy().into_owned())
            {
                fs::remove_file(entry.path()).map_err(err)?;
            }
        }
        Ok(())
    }
}
fn validate_key(key: &str) -> Result<()> {
    if key.len() != 64
        || !key
            .bytes()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
    {
        return Err("Invalid PDF file key.".into());
    }
    Ok(())
}
fn err(error: impl std::fmt::Display) -> String {
    format!("Local storage: {error}")
}

pub fn save_backup(path: &Path, data: &str) -> Result<()> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("zip"))
        != Some(true)
    {
        return Err("Choose a .zip file for the backup.".into());
    }
    let bytes = STANDARD.decode(data).map_err(err)?;
    let parent = path.parent().ok_or("Choose a backup folder.")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(err)?;
    temp.write_all(&bytes).map_err(err)?;
    temp.as_file().sync_all().map_err(err)?;
    temp.persist(path).map_err(err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn change(table: &str, id: &str, kind: &str, data: Value, pdf: Option<&[u8]>) -> Change {
        Change {
            table: table.into(),
            id: id.into(),
            kind: kind.into(),
            data: Some(data),
            pdf: pdf.map(|v| STANDARD.encode(v)),
        }
    }
    #[test]
    fn data_and_pdf_survive_reopen_metadata_edit_and_deletion_preserves_notes() {
        let root = tempfile::tempdir().unwrap();
        let mut db = Library::open(root.path()).unwrap();
        db.commit(vec![
            change(
                "documents",
                "d",
                "add",
                json!({"id":"d","page":1}),
                Some(b"%PDF-persisted"),
            ),
            change(
                "notes",
                "n",
                "add",
                json!({"id":"n","documentId":"d","content":{"type":"doc"}}),
                None,
            ),
        ])
        .unwrap();
        drop(db);
        let mut db = Library::open(root.path()).unwrap();
        let key = db
            .load()
            .unwrap()
            .iter()
            .find(|r| r.table == "documents")
            .unwrap()
            .pdf_key
            .clone()
            .unwrap();
        assert_eq!(
            STANDARD.decode(db.read_pdf(&key).unwrap()).unwrap(),
            b"%PDF-persisted"
        );
        db.commit(vec![change(
            "documents",
            "d",
            "put",
            json!({"id":"d","page":2}),
            None,
        )])
        .unwrap();
        assert_eq!(db.load().unwrap()[0].pdf_key.as_deref(), Some(key.as_str()));
        db.commit(vec![change("documents", "d", "delete", Value::Null, None)])
            .unwrap();
        assert_eq!(db.load().unwrap().len(), 1);
        assert_eq!(db.load().unwrap()[0].data["documentId"], "d");
        assert!(!root.path().join("pdfs").join(format!("{key}.pdf")).exists());
    }
    #[test]
    fn failed_restore_rolls_back_records_and_pdf_files() {
        let root = tempfile::tempdir().unwrap();
        let mut db = Library::open(root.path()).unwrap();
        let result = db.commit(vec![
            change(
                "documents",
                "d",
                "add",
                json!({"id":"d"}),
                Some(b"%PDF-rollback"),
            ),
            change("notes", "n", "add", json!({"id":"wrong"}), None),
        ]);
        assert!(result.is_err());
        assert!(db.load().unwrap().is_empty());
        assert_eq!(fs::read_dir(root.path().join("pdfs")).unwrap().count(), 0);
    }
    #[test]
    fn duplicate_and_invalid_pdf_cannot_damage_existing_records() {
        let root = tempfile::tempdir().unwrap();
        let mut db = Library::open(root.path()).unwrap();
        db.commit(vec![change(
            "notes",
            "n",
            "add",
            json!({"id":"n","title":"original"}),
            None,
        )])
        .unwrap();
        assert!(db
            .commit(vec![change(
                "notes",
                "n",
                "add",
                json!({"id":"n","title":"replacement"}),
                None
            )])
            .is_err());
        assert!(db
            .commit(vec![change(
                "documents",
                "d",
                "add",
                json!({"id":"d"}),
                Some(b"not a pdf")
            )])
            .is_err());
        assert!(db.read_pdf("../../notes").is_err());
        assert_eq!(db.load().unwrap()[0].data["title"], "original");
    }
    #[test]
    fn restart_cleans_orphans_and_future_schema_is_not_opened() {
        let root = tempfile::tempdir().unwrap();
        let db = Library::open(root.path()).unwrap();
        fs::write(root.path().join("pdfs/orphan.pdf"), b"%PDF-orphan").unwrap();
        drop(db);
        let db = Library::open(root.path()).unwrap();
        assert!(!root.path().join("pdfs/orphan.pdf").exists());
        db.connection
            .pragma_update(None, "user_version", 99)
            .unwrap();
        drop(db);
        assert!(Library::open(root.path()).is_err());
    }
    #[test]
    fn backup_write_preserves_old_file_on_error_and_replaces_atomically() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("backup.zip");
        fs::write(&path, b"old").unwrap();
        assert!(save_backup(&path, "invalid base64").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"old");
        save_backup(&path, &STANDARD.encode(b"new backup")).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new backup");
    }
}
