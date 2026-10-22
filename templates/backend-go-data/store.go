package main

import (
	"context"
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)

// Note 是一条示例数据，换成你自己的表就行。
type Note struct {
	ID        int64     `json:"id"`
	Text      string    `json:"text"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"createdAt"`
}

type Store struct {
	db *sql.DB
}

// 表结构在启动时创建；以后加字段用 ALTER TABLE，并保证老数据还能读。
const schema = `
CREATE TABLE IF NOT EXISTS notes (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	text       TEXT NOT NULL,
	author     TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL
);
`

// OpenStore 打开模块自己的 SQLite 文件；数据库只属于本模块，放在本模块的卷里。
func OpenStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	// SQLite 同一时间只允许一个写入者，单连接可以避免 "database is locked"。
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) List(ctx context.Context) ([]Note, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, text, author, created_at FROM notes ORDER BY id DESC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Note{}
	for rows.Next() {
		var n Note
		if err := rows.Scan(&n.ID, &n.Text, &n.Author, &n.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (s *Store) Add(ctx context.Context, text, author string) (*Note, error) {
	n := &Note{Text: text, Author: author, CreatedAt: time.Now().UTC()}
	res, err := s.db.ExecContext(ctx, `INSERT INTO notes (text, author, created_at) VALUES (?, ?, ?)`, n.Text, n.Author, n.CreatedAt)
	if err != nil {
		return nil, err
	}
	n.ID, err = res.LastInsertId()
	return n, err
}
