import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
  if (!SECRET) throw new Error('JWT_SECRET env variable is not set');
  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Проверяем, что пользователь — преподаватель (role_id === 2)
    const user = db.prepare(
      'SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1'
    ).get(payload.username) as { id: number, role_id: number };

    if (!user || user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can assign tests' }, { status: 403 });
    }

    const body = await request.json();
    const { test_id, student_ids } = body;

    if (!test_id || typeof test_id !== 'number') {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json({ error: 'No students selected' }, { status: 400 });
    }

    // Проверяем, существует ли тест
    const test = db.prepare(
      'SELECT id FROM Tests WHERE id = ?'
    ).get(test_id);

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Получаем только существующих и активных студентов из списка
    const students = db.prepare(
      `SELECT id FROM Users WHERE id IN (${student_ids.map(() => '?').join(',')}) AND role_id = 1 AND is_active = 1`
    ).all(...student_ids) as { id: number }[];

    if (students.length === 0) {
      return NextResponse.json({ error: 'No valid students found' }, { status: 404 });
    }

    // Выдаём тест выбранным студентам (создаём записи в TestAssignments)
    const insert = db.prepare(
      `INSERT INTO TestAssignments (test_id, user_id, is_completed, attempt_number)
       VALUES (?, ?, 0, 1)`
    );
    const transaction = db.transaction(() => {
      for (const student of students) {
        try {
          insert.run(test_id, student.id);
        } catch (e: any) {
          // Игнорируем ошибку, если тест уже выдан этому студенту
          if (e.code !== 'SQLITE_CONSTRAINT') throw e;
        }
      }
    });
    transaction();

    return NextResponse.json({
      message: 'Тест выдан выбранным студентам',
      test_id,
      assigned_count: students.length,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}