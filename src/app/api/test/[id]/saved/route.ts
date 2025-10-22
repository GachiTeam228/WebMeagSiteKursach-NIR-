import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECRET) {
    throw new Error('JWT_SECRET env variable is not set');
  }
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

    // Проверяем, что пользователь — студент
    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }
    if (user.role_id !== 1) {
      return NextResponse.json({ error: 'Only students can access saved answers' }, { status: 403 });
    }

    const testId = parseInt((await params).id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    // Получаем активную попытку пользователя по этому тесту
    const attempt = db
      .prepare(`SELECT id FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 0`)
      .get(user.id, testId) as { id: number };

    if (!attempt) {
      return NextResponse.json({ error: 'No active attempt found' }, { status: 404 });
    }

    // Получаем все сохранённые ответы пользователя по этой попытке
    const answers = db
      .prepare(
        `SELECT question_id, answer_option_id
       FROM UserAnswers
       WHERE attempt_id = ?`
      )
      .all(attempt.id) as { question_id: number; answer_option_id: number }[];

    // Группируем ответы по question_id (на случай multiple)
    const grouped: Record<number, number[]> = {};
    for (const ans of answers) {
      if (!grouped[ans.question_id]) grouped[ans.question_id] = [];
      grouped[ans.question_id].push(ans.answer_option_id);
    }

    return NextResponse.json({ answers: grouped });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
