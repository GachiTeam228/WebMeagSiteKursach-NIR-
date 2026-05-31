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

// ===== ML SYSTEM FUNCTIONS =====

/**
 * Calculate student competency profile from their test answers
 * Returns: { [tag_name]: competency_score (0-100), ... }
 * @param studentId - ID of the student
 * @param disciplineId - Optional ID of the discipline to filter tests by
 */
export async function getStudentCompetencyProfile(
  studentId: number,
  disciplineId?: number
): Promise<Record<string, number>> {
  try {
    let query = `
      SELECT 
        t.name as tag_name,
        COUNT(CASE WHEN ua.is_correct = 1 THEN 1 END) as correct_count,
        COUNT(*) as total_count
      FROM UserAnswers ua
      JOIN Attempts a ON ua.attempt_id = a.id
      JOIN Questions q ON ua.question_id = q.id
      JOIN Question_Tags qt ON q.id = qt.question_id
      JOIN Tags t ON qt.tag_id = t.id
      JOIN Tests test ON a.test_id = test.id
      WHERE a.user_id = ? AND a.is_completed = 1
    `;
    
    const params: any[] = [studentId];
    
    // If disciplineId is provided, filter by discipline
    if (disciplineId) {
      query += ` AND test.subject_id = ?`;
      params.push(disciplineId);
    }
    
    query += ` GROUP BY t.name`;
    
    const results = db.prepare(query).all(...params) as Array<{
      tag_name: string;
      correct_count: number;
      total_count: number;
    }>;
    
    const competencyProfile: Record<string, number> = {};
    results.forEach((row) => {
      const percentage = (row.correct_count / row.total_count) * 100;
      competencyProfile[row.tag_name] = parseFloat(percentage.toFixed(1));
    });
    
    return competencyProfile;
  } catch (error) {
    console.error('Error calculating competency profile:', error);
    return {};
  }
}

/**
 * Get student's average test score (normalized to 0-100 percentage)
 * @param studentId - ID of the student
 * @param disciplineId - Optional ID of the discipline to filter tests by
 */
export async function getStudentAverageScore(studentId: number, disciplineId?: number): Promise<number> {
  try {
    let query = `
      SELECT AVG(CASE 
        WHEN max_score > 0 THEN (a.score * 100.0 / max_score)
        ELSE 0
      END) as avg_percentage
      FROM Attempts a
      LEFT JOIN (
        SELECT test_id, COALESCE(SUM(points), 0) as max_score
        FROM Questions
        GROUP BY test_id
      ) q ON a.test_id = q.test_id
      LEFT JOIN Tests t ON a.test_id = t.id
      WHERE a.user_id = ? AND a.is_completed = 1
    `;
    
    const params: any[] = [studentId];
    
    // If disciplineId is provided, filter by discipline
    if (disciplineId) {
      query += ` AND t.subject_id = ?`;
      params.push(disciplineId);
    }
    
    const result = db
      .prepare(query)
      .get(...params) as { avg_percentage: number | null } | undefined;
    
    if (!result?.avg_percentage || result.avg_percentage < 0) return 0.0;
    if (result.avg_percentage > 100) return 100.0;
    return parseFloat(result.avg_percentage.toFixed(1));
  } catch (error) {
    console.error('Error calculating average score:', error);
    return 0.0;
  }
}

/**
 * Get student's activity metrics (total clicks/actions from logs)
 */
export async function getStudentActivityMetrics(
  studentId: number
): Promise<number> {
  try {
    const result = db
      .prepare(
        `
        SELECT COUNT(*) as total_actions
        FROM Activity_Logs
        WHERE user_id = ?
      `
      )
      .get(studentId) as { total_actions: number } | undefined;
    
    return result?.total_actions || 0;
  } catch (error) {
    console.error('Error calculating activity metrics:', error);
    return 0;
  }
}

/**
 * Save student risk analytics to cache
 */
export async function saveStudentRiskAnalytics(
  studentId: number,
  riskProbability: number,
  isAtRisk: boolean,
  weakTags: string[],
  reasons: string[]
): Promise<boolean> {
  try {
    db.prepare(
      `
      INSERT INTO Student_Risk_Analytics 
        (student_id, risk_probability, is_at_risk, weak_tags_json, reasons_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        risk_probability = ?,
        is_at_risk = ?,
        weak_tags_json = ?,
        reasons_json = ?,
        last_analyzed = CURRENT_TIMESTAMP
    `
    ).run(
      studentId,
      riskProbability,
      isAtRisk ? 1 : 0,
      JSON.stringify(weakTags),
      JSON.stringify(reasons),
      // ON CONFLICT updates
      riskProbability,
      isAtRisk ? 1 : 0,
      JSON.stringify(weakTags),
      JSON.stringify(reasons)
    );
    
    return true;
  } catch (error) {
    console.error('Error saving risk analytics:', error);
    return false;
  }
}

/**
 * Get cached student risk analytics
 */
export async function getStudentRiskAnalytics(studentId: number) {
  try {
    const result = db
      .prepare(
        `
        SELECT * FROM Student_Risk_Analytics
        WHERE student_id = ?
      `
      )
      .get(studentId) as {
      student_id: number;
      risk_probability: number;
      is_at_risk: number;
      weak_tags_json: string;
      reasons_json: string;
      last_analyzed: string;
    } | undefined;
    
    if (!result) return null;
    
    return {
      studentId: result.student_id,
      riskProbability: result.risk_probability,
      isAtRisk: result.is_at_risk === 1,
      weakTags: JSON.parse(result.weak_tags_json || '[]'),
      reasons: JSON.parse(result.reasons_json || '[]'),
      lastAnalyzed: result.last_analyzed,
    };
  } catch (error) {
    console.error('Error retrieving risk analytics:', error);
    return null;
  }
}
