import { Injectable, OnModuleInit } from "@nestjs/common";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db!: Database.Database;

  onModuleInit(): void {
    const dbPath = resolve(process.cwd(), "data", "velogen.sqlite");
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  get connection(): Database.Database {
    return this.db;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        author TEXT,
        occurred_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(source_id, external_id),
        FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tone TEXT,
        format TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_sources (
        session_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(session_id, source_id),
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS blog_posts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        provider TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS blog_post_revisions (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
        UNIQUE(post_id, version)
      );
    `);

    this.ensureSessionColumns();
    this.ensureBlogPostColumns();
  }

  private ensureSessionColumns(): void {
    this.addColumnIfMissing("sessions", "provider", "TEXT NOT NULL DEFAULT 'mock'");
    this.db.exec("UPDATE sessions SET provider = COALESCE(provider, 'mock')");
  }

  private ensureBlogPostColumns(): void {
    this.addColumnIfMissing("blog_posts", "updated_at", "TEXT");
    this.addColumnIfMissing("blog_posts", "status", "TEXT NOT NULL DEFAULT 'draft'");
    this.addColumnIfMissing("blog_posts", "generation_meta_json", "TEXT");

    this.db.exec("UPDATE blog_posts SET updated_at = COALESCE(updated_at, created_at)");
    this.db.exec("UPDATE blog_posts SET status = COALESCE(status, 'draft')");
  }

  private addColumnIfMissing(tableName: string, columnName: string, columnDef: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    const exists = columns.some((column) => column.name === columnName);
    if (!exists) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    }
  }
}
