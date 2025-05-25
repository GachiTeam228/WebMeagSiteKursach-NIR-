import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET(
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

    // Получаем пользователя
    const user = db.prepare(
      'SELECT id, username, is_active FROM Users WHERE username = ? AND is_active = 1'
    ).get(payload.username) as {id: number, username: string, is_active: boolean}

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    const testId = parseInt((await params).id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    // Получаем завершённую попытку пользователя по этому тесту
    const attempt = db.prepare(
      `SELECT id, score, is_completed FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 1 ORDER BY end_time DESC LIMIT 1`
    ).get(user.id, testId) as {id: number, score: number, is_completed: boolean}

    if (!attempt) {
      return NextResponse.json({ error: 'No completed attempt found' }, { status: 404 });
    }

    // Получаем тест
    const test = db.prepare(
      `SELECT title, passing_score, time_limit_minutes FROM Tests WHERE id = ?`
    ).get(testId) as {title: string, passing_score: number, time_limit_minutes: number}

    // Получаем вопросы и ответы пользователя
    const questions = db.prepare(
      `SELECT q.id as question_id, q.question_text, q.question_type,
              GROUP_CONCAT(ua.answer_option_id) as user_answer_ids,
              GROUP_CONCAT(ao.option_text) as user_answers,
              GROUP_CONCAT(ua.is_correct) as is_corrects
         FROM Questions q
         LEFT JOIN UserAnswers ua ON ua.question_id = q.id AND ua.attempt_id = ?
         LEFT JOIN AnswerOptions ao ON ao.id = ua.answer_option_id
         WHERE q.test_id = ?
         GROUP BY q.id
         ORDER BY q.order_number`
    ).all(attempt.id, testId);

    // Получаем правильные ответы для вопросов
    const correctOptions = db.prepare(
      `SELECT question_id, GROUP_CONCAT(option_text) as correct_answers
         FROM AnswerOptions
         WHERE question_id IN (SELECT id FROM Questions WHERE test_id = ?)
           AND is_correct = 1
         GROUP BY question_id`
    ).all(testId) as { question_id: number, correct_answers: string }[];

    // Собираем результат
    const questionResults = questions.map((q: any) => {
      const correct = correctOptions.find((c: any) => c.question_id === q.question_id);
      return {
        question_id: q.question_id,
        question_text: q.question_text,
        question_type: q.question_type,
        user_answers: q.user_answers ? q.user_answers.split(',') : [],
        is_correct: q.is_corrects ? q.is_corrects.split(',').every((v: string) => v === '1') : false,
        correct_answers: correct ? correct.correct_answers.split(',') : [],
      };
    });

    // Считаем баллы
    const maxScore = questions.length;
    const score = attempt.score ?? questionResults.filter(q => q.is_correct).length;
    const passed = test.passing_score ? score >= test.passing_score : true;

    return NextResponse.json({
      testTitle: test.title,
      score,
      maxScore,
      passed,
      questions: questionResults,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}