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
      return NextResponse.json({ error: 'Only students can end attempts' }, { status: 403 });
    }

    const testId = parseInt((await params).id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    // Проверяем, есть ли активная попытка
    const attempt = db.prepare(
      `SELECT id, is_completed FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 0`
    ).get(user.id, testId) as {id: number, is_completed: boolean}

    if (!attempt) {
      return NextResponse.json({ error: 'No active attempt found' }, { status: 404 });
    }

    // --- Считаем количество правильных ответов ---
    const correctCount = (db.prepare(
      `SELECT COUNT(*) as cnt
       FROM UserAnswers
       WHERE attempt_id = ? AND is_correct = 1`
    ).get(attempt.id) as {cnt: number}).cnt;

    // Завершаем попытку (ставим is_completed = 1, фиксируем время окончания и обновляем score)
    db.prepare(
      `UPDATE Attempts SET is_completed = 1, end_time = datetime('now'), score = ? WHERE id = ?`
    ).run(correctCount, attempt.id);

    return NextResponse.json({ message: 'Test attempt completed', attempt_id: attempt.id, score: correctCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}