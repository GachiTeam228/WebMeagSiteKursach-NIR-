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

    const user = db.prepare(
      'SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1'
    ).get(payload.username) as {id: number, role_id: number}

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }
    if (user.role_id !== 1) {
      return NextResponse.json({ error: 'Only students can answer questions' }, { status: 403 });
    }

    const testId = parseInt((await params).id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    const { question_id, answer_option_id } = await request.json();

    if (!question_id || answer_option_id === undefined) {
      return NextResponse.json({ error: 'Missing question_id or answer_option_id' }, { status: 400 });
    }

    // Получаем активную попытку
    const attempt = db.prepare(
      `SELECT id, is_completed FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 0`
    ).get(user.id, testId) as {id: number, is_completed: boolean}

    if (!attempt) {
      return NextResponse.json({ error: 'No active attempt found' }, { status: 404 });
    }

    // Узнаём тип вопроса
    const question = db.prepare(
      `SELECT question_type FROM Questions WHERE id = ?`
    ).get(question_id) as {question_type: string};

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // MULTIPLE
    if (question.question_type === 'multiple') {
      // answer_option_id должен быть массивом
      const answerIds: number[] = Array.isArray(answer_option_id)
        ? answer_option_id
        : [answer_option_id];

      // Удаляем старые ответы пользователя на этот вопрос в этой попытке
      db.prepare(
        `DELETE FROM UserAnswers WHERE attempt_id = ? AND question_id = ?`
      ).run(attempt.id, question_id);

      // Вставляем новые ответы
      const insert = db.prepare(
        `INSERT INTO UserAnswers (attempt_id, question_id, answer_option_id, is_correct, answered_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      );

      for (const optionId of answerIds) {
        // Проверяем правильность каждого варианта
        const option = db.prepare(
          `SELECT is_correct FROM AnswerOptions WHERE id = ? AND question_id = ?`
        ).get(optionId, question_id) as {is_correct: boolean};

        if (!option) continue;

        insert.run(attempt.id, question_id, optionId, option.is_correct ? 1 : 0);
      }

      return NextResponse.json({ message: 'Answers saved', answer_option_id: answerIds });
    }

    // SINGLE (или text)
    // Проверяем правильность ответа
    const option = db.prepare(
      `SELECT is_correct FROM AnswerOptions WHERE id = ? AND question_id = ?`
    ).get(answer_option_id, question_id) as {is_correct: boolean};

    if (!option) {
      return NextResponse.json({ error: 'Answer option not found' }, { status: 404 });
    }

    const is_correct = option.is_correct ? 1 : 0;

    // Проверяем, существует ли уже ответ пользователя на этот вопрос в этой попытке
    const existingAnswer = db.prepare(
      `SELECT id FROM UserAnswers WHERE attempt_id = ? AND question_id = ?`
    ).get(attempt.id, question_id) as {id: number};

    if (existingAnswer) {
      if (attempt.is_completed) {
        return NextResponse.json({ error: 'Attempt already completed' }, { status: 403 });
      }
      db.prepare(
        `UPDATE UserAnswers SET answer_option_id = ?, is_correct = ?, answered_at = datetime('now') WHERE id = ?`
      ).run(answer_option_id, is_correct, existingAnswer.id);

      return NextResponse.json({ message: 'Answer updated' });
    } else {
      db.prepare(
        `INSERT INTO UserAnswers (attempt_id, question_id, answer_option_id, is_correct, answered_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(attempt.id, question_id, answer_option_id, is_correct);

      return NextResponse.json({ message: 'Answer saved' });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

const body = `
{
    question_id: number,
    answer_option_id: number,
}
`