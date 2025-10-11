import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET() {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    // 1. Аутентификация и получение ID преподавателя
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const payload: any = jwt.verify(token, SECRET);
    const teacherId = payload.id;

    if (!teacherId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    // 2. SQL-запрос для получения активных тестов
    const activeTests = db
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
        AND ta.deadline > CURRENT_TIMESTAMP
        AND t.is_active = 1
      GROUP BY t.id, t.title, s.name, t.time_limit_minutes
      ORDER BY due ASC
    `
      )
      .all(teacherId);

    return NextResponse.json(activeTests);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    console.error('Failed to fetch active tests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
