use serde::Deserialize;
use sqlx::{Acquire, SqlitePool};
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Deserialize)]
pub struct Line {
    account_id: i64,
    debit_amount: i64,
    credit_amount: i64,
    description: String,
}

#[derive(Deserialize)]
pub struct Entry {
    date: String,
    description: String,
    lines: Vec<Line>,
}

#[derive(Deserialize)]
pub struct Rule {
    keyword: String,
    account_id: i64,
    entry_type: String,
}

fn valid_date(date: &str) -> bool {
    let bytes = date.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes
            .iter()
            .enumerate()
            .any(|(i, b)| i != 4 && i != 7 && !b.is_ascii_digit())
    {
        return false;
    }
    let year = date[0..4].parse::<u32>().unwrap_or(0);
    let month = date[5..7].parse::<usize>().unwrap_or(0);
    let day = date[8..10].parse::<u32>().unwrap_or(0);
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    year > 0 && (1..=12).contains(&month) && day > 0 && day <= days[month - 1]
}

fn validate(entry: &Entry) -> Result<(), String> {
    if !valid_date(&entry.date) {
        return Err("日付が正しくありません".into());
    }
    if entry.lines.len() < 2 {
        return Err("仕訳には2行以上の明細が必要です".into());
    }
    let mut debit = 0_i64;
    let mut credit = 0_i64;
    for line in &entry.lines {
        if line.account_id <= 0
            || line.debit_amount < 0
            || line.credit_amount < 0
            || (line.debit_amount > 0) == (line.credit_amount > 0)
        {
            return Err(
                "科目を指定し、各行の借方・貸方の片方に正の整数円を入力してください".into(),
            );
        }
        debit = debit
            .checked_add(line.debit_amount)
            .ok_or("金額が大きすぎます")?;
        credit = credit
            .checked_add(line.credit_amount)
            .ok_or("金額が大きすぎます")?;
    }
    if debit > 9_007_199_254_740_991 || credit > 9_007_199_254_740_991 {
        return Err("金額が大きすぎます".into());
    }
    if debit != credit {
        return Err("借方合計と貸方合計が一致しません".into());
    }
    Ok(())
}

// A transaction must own one connection for its entire lifetime. Separate plugin
// execute calls use a pool and cannot safely implement BEGIN / COMMIT in JS.
async fn save(pool: &SqlitePool, entries: Vec<Entry>, rules: Vec<Rule>) -> Result<(), String> {
    if entries.is_empty() {
        return Err("保存する仕訳がありません".into());
    }
    for entry in &entries {
        validate(entry)?;
    }
    for rule in &rules {
        if rule.keyword.trim().is_empty()
            || rule.account_id <= 0
            || !matches!(rule.entry_type.as_str(), "debit" | "credit")
        {
            return Err("辞書ルールが正しくありません".into());
        }
    }
    let mut connection = pool.acquire().await.map_err(|e| e.to_string())?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *connection)
        .await
        .map_err(|e| e.to_string())?;
    let mut tx = connection.begin().await.map_err(|e| e.to_string())?;
    let result: Result<(), sqlx::Error> = async {
        for entry in entries {
            let id = sqlx::query("INSERT INTO journal_entries (date, description) VALUES (?, ?)")
                .bind(entry.date).bind(entry.description).execute(&mut *tx).await?.last_insert_rowid();
            for line in entry.lines {
                sqlx::query("INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount, description) VALUES (?, ?, ?, ?, ?)")
                    .bind(id).bind(line.account_id).bind(line.debit_amount).bind(line.credit_amount)
                    .bind(line.description).execute(&mut *tx).await?;
            }
        }
        for rule in rules {
            sqlx::query("INSERT INTO import_rules (keyword, account_id, entry_type) VALUES (?, ?, ?) ON CONFLICT(keyword) DO UPDATE SET account_id=excluded.account_id, entry_type=excluded.entry_type")
                .bind(rule.keyword.trim().to_lowercase()).bind(rule.account_id).bind(rule.entry_type)
                .execute(&mut *tx).await?;
        }
        Ok(())
    }.await;
    match result {
        Ok(()) => tx.commit().await.map_err(|e| e.to_string()),
        Err(error) => {
            tx.rollback().await.map_err(|e| e.to_string())?;
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub async fn save_journal_entries(
    databases: tauri::State<'_, DbInstances>,
    entries: Vec<Entry>,
    rules: Vec<Rule>,
) -> Result<(), String> {
    let pool = {
        let databases = databases.0.read().await;
        match databases.get("sqlite:aoshoku.db") {
            Some(DbPool::Sqlite(pool)) => pool.clone(),
            _ => return Err("データベースが初期化されていません".into()),
        }
    };
    save(&pool, entries, rules).await
}

#[cfg(test)]
mod tests {
    use super::*;
    fn entry(account: i64) -> Entry {
        Entry {
            date: "2025-01-01".into(),
            description: "test".into(),
            lines: vec![
                Line {
                    account_id: 1,
                    debit_amount: 100,
                    credit_amount: 0,
                    description: "".into(),
                },
                Line {
                    account_id: account,
                    debit_amount: 0,
                    credit_amount: 100,
                    description: "".into(),
                },
            ],
        }
    }
    #[test]
    fn rejects_invalid_entries() {
        assert!(valid_date("2024-02-29"));
        assert!(!valid_date("2025-02-29"));
        assert!(!valid_date("2025-1-01"));
        let mut e = entry(1);
        e.lines[0].debit_amount = 99;
        assert!(validate(&e).is_err());
        e.lines.clear();
        assert!(validate(&e).is_err());
    }
    #[test]
    fn batch_and_rules_rollback_together() {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
            sqlx::raw_sql("CREATE TABLE accounts(id INTEGER PRIMARY KEY); INSERT INTO accounts VALUES(1); CREATE TABLE journal_entries(id INTEGER PRIMARY KEY, date TEXT, description TEXT); CREATE TABLE journal_lines(id INTEGER PRIMARY KEY, entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE, account_id INTEGER REFERENCES accounts(id), debit_amount INTEGER, credit_amount INTEGER, description TEXT); CREATE TABLE import_rules(keyword TEXT UNIQUE, account_id INTEGER REFERENCES accounts(id), entry_type TEXT);").execute(&pool).await.unwrap();
            assert!(save(&pool, vec![entry(1), entry(999)], vec![])
                .await
                .is_err());
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_entries")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count.0, 0);
            let bad_rule = Rule {
                keyword: "test".into(),
                account_id: 999,
                entry_type: "debit".into(),
            };
            assert!(save(&pool, vec![entry(1)], vec![bad_rule]).await.is_err());
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_lines")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count.0, 0);
            save(&pool, vec![entry(1), entry(1)], vec![]).await.unwrap();
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_lines")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count.0, 4);
            sqlx::query("DELETE FROM journal_entries")
                .execute(&pool)
                .await
                .unwrap();
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM journal_lines")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count.0, 0);
        });
    }
}
