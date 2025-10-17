// import Database from 'better-sqlite3';
// import path from 'path';

// const dbPath = path.join(process.cwd(), 'db', 'base.db');
// const db = new Database(dbPath);

// function initDatabase() {
//   try {
//     db.exec(`
//             -- Роли пользователей
//             CREATE TABLE IF NOT EXISTS Roles (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 is_admin BOOLEAN NOT NULL CHECK (is_admin IN (0, 1)) DEFAULT 0
//             );

//             -- Дисциплины
//             CREATE TABLE IF NOT EXISTS Subjects (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 name TEXT NOT NULL UNIQUE,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP
//             );

//             -- Группы студентов
//             CREATE TABLE IF NOT EXISTS Groups (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 name TEXT NOT NULL UNIQUE,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP
//             );

//             -- Промежуточная таблица для связи N:M
//             CREATE TABLE IF NOT EXISTS Group_Subjects (
//                 group_id INTEGER REFERENCES Groups(id) ON DELETE CASCADE,
//                 subject_id INTEGER REFERENCES Subjects(id) ON DELETE CASCADE,
//                 PRIMARY KEY (group_id, subject_id)
//             );

//             -- Пользователи
//             CREATE TABLE IF NOT EXISTS Users (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 username TEXT UNIQUE,
//                 password_hash TEXT NOT NULL,
//                 first_name TEXT,
//                 last_name TEXT,
//                 role_id INTEGER REFERENCES Roles(id) ON DELETE SET NULL,
//                 group_id INTEGER REFERENCES Groups(id) ON DELETE SET NULL,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//                 is_active BOOLEAN NOT NULL CHECK (is_active IN (0, 1)) DEFAULT 1
//             );

//             -- Тесты
//             CREATE TABLE IF NOT EXISTS Tests (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 title TEXT NOT NULL,
//                 description TEXT,
//                 subject_id INTEGER REFERENCES Subjects(id) ON DELETE CASCADE,
//                 time_limit_minutes INTEGER,
//                 passing_score INTEGER,
//                 is_active BOOLEAN NOT NULL CHECK (is_active IN (0, 1)) DEFAULT 1,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//                 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
//             );

//             -- Вопросы
//             CREATE TABLE IF NOT EXISTS Questions (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 test_id INTEGER REFERENCES Tests(id) ON DELETE CASCADE,
//                 question_text TEXT NOT NULL,
//                 question_type TEXT NOT NULL CHECK (question_type IN ('single', 'multiple', 'text')),
//                 points INTEGER DEFAULT 1,
//                 order_number INTEGER,
//                 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//                 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
//             );

//             -- Варианты ответов
//             CREATE TABLE IF NOT EXISTS AnswerOptions (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 question_id INTEGER REFERENCES Questions(id) ON DELETE CASCADE,
//                 option_text TEXT NOT NULL,
//                 is_correct BOOLEAN NOT NULL CHECK (is_correct IN (0, 1)) DEFAULT 0,
//                 order_number INTEGER
//             );

//             -- Попытки прохождения теста
//             CREATE TABLE IF NOT EXISTS Attempts (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
//                 test_id INTEGER REFERENCES Tests(id) ON DELETE CASCADE,
//                 start_time TEXT DEFAULT CURRENT_TIMESTAMP,
//                 end_time TEXT,
//                 is_completed BOOLEAN NOT NULL CHECK (is_completed IN (0, 1)) DEFAULT 0,
//                 score INTEGER DEFAULT 0
//             );

//             -- Ответы пользователей
//             CREATE TABLE IF NOT EXISTS UserAnswers (
//                 id INTEGER PRIMARY KEY AUTOINCREMENT,
//                 attempt_id INTEGER REFERENCES Attempts(id) ON DELETE CASCADE,
//                 question_id INTEGER REFERENCES Questions(id) ON DELETE CASCADE,
//                 answer_option_id INTEGER REFERENCES AnswerOptions(id) ON DELETE SET NULL,
//                 answer_text TEXT,
//                 is_correct BOOLEAN CHECK (is_correct IN (0, 1)),
//                 points_earned INTEGER DEFAULT 0,
//                 answered_at TEXT DEFAULT CURRENT_TIMESTAMP
//             );
//     `);
//     console.log('Database initialized successfully');
//   } catch (error) {
//     console.error('Database initialization failed:', error);
//   }
// }

// export { db };

// lib/db.ts - улучшенная версия

// lib/db.ts

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db', 'base.db');

// Простое создание экземпляра без автоматического закрытия
export const db = new Database(dbPath);

// Оптимизации SQLite
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');

// В development режиме Next.js сам управляет жизненным циклом
// В production процесс Node.js автоматически закроет соединение при завершении
