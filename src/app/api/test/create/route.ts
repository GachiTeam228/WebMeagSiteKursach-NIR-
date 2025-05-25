import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
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

    // Проверяем, что пользователь админ
    const user = db.prepare(`
      SELECT Users.id, Roles.is_admin
      FROM Users
      LEFT JOIN Roles ON Users.role_id = Roles.id
      WHERE Users.username = ?
    `).get(payload.username) as {id: number, is_admin: boolean};

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: not admin' }, { status: 403 });
    }

    const body = await request.json();

    // Ожидаем структуру как в вашем примере
    const { title, duration, questions } = body;

    if (!title || !duration || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Вставляем тест
    const insertTest = db.prepare(
      'INSERT INTO Tests (title, time_limit_minutes, is_active, deadline) VALUES (?, ?, 1, ?)'
    );
    const result = insertTest.run(title, duration, '2025-05-31 12:37:45');
    const testId = result.lastInsertRowid as number;

    // Вставляем вопросы
    const insertQuestion = db.prepare(
      'INSERT INTO Questions (test_id, question_text, question_type, order_number) VALUES (?, ?, ?, ?)'
    );
    const insertOption = db.prepare(
      'INSERT INTO AnswerOptions (question_id, option_text, is_correct, order_number) VALUES (?, ?, ?, ?)'
    );

    for (const q of questions) {
      const qResult = insertQuestion.run(testId, q.text, q.type, questions.indexOf(q));
      const questionId = qResult.lastInsertRowid as number;

      q.options.forEach((option: string, idx: number) => {
        const isCorrect = Array.isArray(q.correctAnswers)
          ? q.correctAnswers.includes(idx)
          : q.correctAnswers === idx;
        insertOption.run(questionId, option, isCorrect ? 1 : 0, idx);
      });
    }

    return NextResponse.json({ success: true, testId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}