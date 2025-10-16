// scripts/init-db.ts - скрипт инициализации БД

import Database from 'better-sqlite3';
import path from 'path';
// import fs from 'fs';

const dbPath = path.join(process.cwd(), 'database.db');

// Удаляем старую БД если нужно
// fs.unlinkSync(dbPath); // Раскомментируйте для полного пересоздания

const db = new Database(dbPath);

// Создаём таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role_id INTEGER NOT NULL,
    group_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES Groups(id)
  );

  CREATE TABLE IF NOT EXISTS Groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES Users(id)
  );

  CREATE TABLE IF NOT EXISTS Chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    order_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    chapter_id INTEGER,
    order_number INTEGER DEFAULT 0,
    time_limit_minutes INTEGER,
    passing_score INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES Chapters(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS Questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    points INTEGER DEFAULT 1,
    order_number INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES Tests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS AnswerOptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    is_correct INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS TestAssignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_completed INTEGER DEFAULT 0,
    deadline TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES Tests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    UNIQUE(test_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS Attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    test_id INTEGER NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    score INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES Tests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS UserAnswers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_option_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES Attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_option_id) REFERENCES AnswerOptions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Group_Subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE,
    UNIQUE(group_id, subject_id)
  );
`);

// Создаём индексы
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
  CREATE INDEX IF NOT EXISTS idx_users_role_active ON Users(role_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_users_group ON Users(group_id);
  CREATE INDEX IF NOT EXISTS idx_tests_subject ON Tests(subject_id);
  CREATE INDEX IF NOT EXISTS idx_tests_chapter ON Tests(chapter_id);
  CREATE INDEX IF NOT EXISTS idx_tests_active ON Tests(is_active);
  CREATE INDEX IF NOT EXISTS idx_assignments_test_user ON TestAssignments(test_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_user ON TestAssignments(user_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON TestAssignments(deadline);
  CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON Attempts(user_id, test_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_completed ON Attempts(is_completed);
  CREATE INDEX IF NOT EXISTS idx_questions_test ON Questions(test_id);
  CREATE INDEX IF NOT EXISTS idx_chapters_subject ON Chapters(subject_id);
  CREATE INDEX IF NOT EXISTS idx_group_subjects_group ON Group_Subjects(group_id);
  CREATE INDEX IF NOT EXISTS idx_group_subjects_subject ON Group_Subjects(subject_id);
`);

console.log('Database initialized successfully!');

db.close();
