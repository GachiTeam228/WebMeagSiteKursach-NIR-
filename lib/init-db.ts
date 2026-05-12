// scripts/init-db.ts - скрипт инициализации БД

import Database from 'better-sqlite3';
import path from 'path';
// import fs from 'fs';

const dbPath = path.join(process.cwd(), 'database.db');

// Удаляем старую БД если нужно
// fs.unlinkSync(dbPath); // Раскомментируйте для полного пересоздания

const db = new Database(dbPath);

// Создаём таблицы в правильном порядке с учетом внешних ключей (Foreign Keys)
db.exec(`
  -- 1. Роли (Новая таблица со схемы)
  CREATE TABLE IF NOT EXISTS Roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_admin INTEGER DEFAULT 0
  );

  -- 2. Группы
  CREATE TABLE IF NOT EXISTS Groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 3. Пользователи (Связь с Roles и Groups)
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
    FOREIGN KEY (role_id) REFERENCES Roles(id),
    FOREIGN KEY (group_id) REFERENCES Groups(id)
  );

  -- 4. Связь Преподаватели - Группы (Новая таблица со схемы)
  CREATE TABLE IF NOT EXISTS Teachers_Groups (
    teacher_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    PRIMARY KEY (teacher_id, group_id),
    FOREIGN KEY (teacher_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE CASCADE
  );

  -- 5. Предметы
  CREATE TABLE IF NOT EXISTS Subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES Users(id)
  );

  -- 6. Связь Группы - Предметы
  CREATE TABLE IF NOT EXISTS Group_Subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE,
    UNIQUE(group_id, subject_id)
  );

  -- 7. Главы/Разделы
  CREATE TABLE IF NOT EXISTS Chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    order_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES Subjects(id) ON DELETE CASCADE
  );

  -- 8. Тесты
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

  -- 9. Вопросы
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

  -- 10. Варианты ответов (Добавлены order_number и image_url со схемы)
  CREATE TABLE IF NOT EXISTS AnswerOptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    is_correct INTEGER DEFAULT 0,
    order_number INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE
  );

  -- 11. Назначения тестов
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

  -- 12. Попытки прохождения
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

  -- 13. Ответы пользователей (Добавлены answer_text, is_correct, points_earned, answered_at)
  CREATE TABLE IF NOT EXISTS UserAnswers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_option_id INTEGER, 
    answer_text TEXT,
    is_correct INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES Attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_option_id) REFERENCES AnswerOptions(id) ON DELETE CASCADE
  );

    // --- БЛОК ТАБЛИЦ ДЛЯ СИСТЕМЫ ПОДДЕРЖКИ ПРИНЯТИЯ РЕШЕНИЙ (СППР) И ML ---

  -- 14. Справочник тегов (компетенций)
  CREATE TABLE IF NOT EXISTS Tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,          
    description TEXT,                   
    is_core INTEGER DEFAULT 0           -- 1 - базовая дисциплина, 0 - микро-навык
  );

  -- 15. Связь вопросов с тегами (Много-ко-многим)
  -- Позволяет привязать к одному вопросу несколько навыков (например, "SQL" и "JOIN")
  CREATE TABLE IF NOT EXISTS Question_Tags (
    question_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    weight REAL DEFAULT 1.0,            -- Значимость тега в данном вопросе
    PRIMARY KEY (question_id, tag_id),
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES Tags(id) ON DELETE CASCADE
  );

  -- 16. Кэш аналитики СППР
  -- Хранит результаты прогноза от FastAPI, чтобы не делать запросы к Python при каждом обновлении страницы
  CREATE TABLE IF NOT EXISTS Student_Risk_Analytics (
    student_id INTEGER PRIMARY KEY,
    risk_probability REAL,              -- Вероятность отчисления (от 0.0 до 1.0)
    is_at_risk INTEGER DEFAULT 0,       -- 1 - если в зоне риска
    weak_tags_json TEXT,                -- Массив проблемных компетенций (JSON строка: '["JOIN", "SQL"]')
    reasons_json TEXT,                  -- Причины риска от SHAP (JSON строка)
    last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE
  );
`);

// Создаём индексы для быстрого поиска
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
    -- Индексы для ML-аналитики
  CREATE INDEX IF NOT EXISTS idx_question_tags_question ON Question_Tags(question_id);
  CREATE INDEX IF NOT EXISTS idx_question_tags_tag ON Question_Tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_useranswers_correct ON UserAnswers(is_correct);
`);

console.log('Database initialized successfully!');

db.close();