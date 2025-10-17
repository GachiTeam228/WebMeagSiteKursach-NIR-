import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

// Функция для обработки просроченных тестов
function processExpiredTests() {
  try {
    const now = new Date().toISOString();

    const expiredAssignments = db
      .prepare(
        `SELECT ta.id, ta.test_id, ta.user_id, ta.deadline
         FROM TestAssignments ta
         WHERE ta.deadline < ?
         AND ta.is_completed = 0
         AND ta.deadline IS NOT NULL`
      )
      .all(now) as { id: number; test_id: number; user_id: number; deadline: string }[];

    if (expiredAssignments.length === 0) {
      return { processed: 0 };
    }

    let processedCount = 0;

    const transaction = db.transaction(() => {
      for (const assignment of expiredAssignments) {
        try {
          const existingAttempts = db
            .prepare('SELECT COUNT(*) as count FROM Attempts WHERE user_id = ? AND test_id = ?')
            .get(assignment.user_id, assignment.test_id) as { count: number };

          if (existingAttempts.count === 0) {
            db.prepare(
              `INSERT INTO Attempts (user_id, test_id, start_time, end_time, score, is_completed)
               VALUES (?, ?, ?, ?, 0, 1)`
            ).run(assignment.user_id, assignment.test_id, now, now);
          }

          db.prepare('UPDATE TestAssignments SET is_completed = 1 WHERE id = ?').run(assignment.id);
          processedCount++;
        } catch (err) {
          console.error(`Error processing assignment ${assignment.id}:`, err);
        }
      }
    });

    transaction();

    return { processed: processedCount };
  } catch (error) {
    return { processed: 0, error };
  }
}

export async function GET() {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    // Обрабатываем просроченные тесты перед получением активных
    processExpiredTests();

    // 1. Аутентификация
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload: any = jwt.verify(token, SECRET);
    const userId = payload.id;

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    // 2. Получаем информацию о пользователе
    const user = db.prepare('SELECT id, role_id FROM Users WHERE id = ? AND is_active = 1').get(userId) as
      | { id: number; role_id: number }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    // Текущее время для фильтрации
    const now = new Date().toISOString();

    let activeTests;

    // 3. Если преподаватель (role_id = 2)
    if (user.role_id === 2) {
      activeTests = db
        .prepare(
          `
        SELECT
          t.id,
          t.title AS name,
          s.name AS discipline,
          MIN(ta.deadline) AS due,
          t.time_limit_minutes AS duration,
          GROUP_CONCAT(DISTINCT g.name) AS groups,
          (SELECT COUNT(*) FROM Questions WHERE test_id = t.id) AS questions,
          (SELECT COALESCE(SUM(points), 0) FROM Questions WHERE test_id = t.id) AS maxScore
        FROM Tests t
        JOIN Subjects s ON t.subject_id = s.id
        JOIN TestAssignments ta ON t.id = ta.test_id
        JOIN Users u ON ta.user_id = u.id
        JOIN Groups g ON u.group_id = g.id
        WHERE
          s.teacher_id = ?
          AND ta.deadline IS NOT NULL
          AND ta.deadline > ?
          AND t.is_active = 1
        GROUP BY t.id, t.title, s.name, t.time_limit_minutes
        HAVING MIN(ta.deadline) > ?
        ORDER BY due ASC
      `
        )
        .all(user.id, now, now);
    }
    // 4. Если студент (role_id = 1)
    else if (user.role_id === 1) {
      activeTests = db
        .prepare(
          `
        SELECT
          t.id,
          t.title AS name,
          s.name AS discipline,
          ta.deadline AS due,
          t.time_limit_minutes AS duration,
          g.name AS groups,
          (SELECT COUNT(*) FROM Questions WHERE test_id = t.id) AS questions,
          (SELECT COALESCE(SUM(points), 0) FROM Questions WHERE test_id = t.id) AS maxScore,
          ta.is_completed,
          (SELECT COUNT(*) FROM Attempts WHERE user_id = ? AND test_id = t.id AND is_completed = 1) AS completed_attempts
        FROM TestAssignments ta
        JOIN Tests t ON ta.test_id = t.id
        JOIN Subjects s ON t.subject_id = s.id
        JOIN Users u ON ta.user_id = u.id
        LEFT JOIN Groups g ON u.group_id = g.id
        WHERE
          ta.user_id = ?
          AND ta.deadline IS NOT NULL
          AND ta.deadline > ?
          AND t.is_active = 1
          AND ta.is_completed = 0
        ORDER BY ta.deadline ASC
      `
        )
        .all(user.id, user.id, now);
    } else {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 403 });
    }

    return NextResponse.json(activeTests);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    console.error('Failed to fetch active tests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
