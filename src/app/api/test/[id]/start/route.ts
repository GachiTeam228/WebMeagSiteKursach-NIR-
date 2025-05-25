import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!SECRET) {
    throw new Error('JWT_SECRET env variable is not set');
  }
  try {
    // --- Проверка токена ---
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

    // Получаем пользователя и его роль
    const user = db.prepare(
      'SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1'
    ).get(payload.username) as {id: number, role_id: number}

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }
    if (user.role_id !== 1) {
      return NextResponse.json({ error: 'Only students can start attempts' }, { status: 403 });
    }

    const testId = parseInt((await params).id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    // Проверяем, что тест существует
    const test = db.prepare(
      'SELECT id FROM Tests WHERE id = ?'
    ).get(testId);

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Проверяем, есть ли уже попытка
    const attempt = db.prepare(
      `SELECT id, start_time, is_completed FROM Attempts WHERE user_id = ? AND test_id = ?`
    ).get(user.id, testId) as {id: number, start_time: string, is_completed: boolean}

    if (attempt) {
      return NextResponse.json({
        attempt_id: attempt.id,
        start_time: attempt.start_time,
        is_completed: attempt.is_completed,
        message: 'Attempt already exists'
      });
    }

    // Создаем новую попытку
    const result = db.prepare(
      `INSERT INTO Attempts (user_id, test_id, start_time, is_completed, score)
       VALUES (?, ?, datetime('now'), 0, 0)`
    ).run(user.id, testId);

    const newAttempt = db.prepare(
      `SELECT id, start_time FROM Attempts WHERE id = ?`
    ).get(result.lastInsertRowid) as {id: number, start_time: string}

    return NextResponse.json({
      attempt_id: newAttempt.id,
      start_time: newAttempt.start_time,
      message: 'Attempt started'
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}