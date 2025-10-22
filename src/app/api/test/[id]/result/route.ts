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

    const user = db.prepare('SELECT id FROM Users WHERE username = ? AND is_active = 1').get(payload.username) as {
      id: number;
    };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    const testId = parseInt((await params).id, 10);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    const attempt = db
      .prepare(
        `SELECT id, score FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 1 ORDER BY end_time DESC LIMIT 1`
      )
      .get(user.id, testId) as { id: number; score: number | null };

    if (!attempt) {
      return NextResponse.json({ error: 'No completed attempt found' }, { status: 404 });
    }

    const test = db.prepare(`SELECT title, passing_score FROM Tests WHERE id = ?`).get(testId) as {
      title: string;
      passing_score: number | null;
    };

    // Оптимизированный запрос для получения вопросов, ответов пользователя и правильных ответов
    const questionsData = db
      .prepare(
        `
      SELECT
        q.id as question_id,
        q.question_text,
        q.question_type,
        q.points,
        (SELECT GROUP_CONCAT(ao.option_text) FROM AnswerOptions ao JOIN UserAnswers ua ON ao.id = ua.answer_option_id WHERE ua.attempt_id = ? AND ua.question_id = q.id) as user_answers,
        (SELECT GROUP_CONCAT(ao.option_text) FROM AnswerOptions ao WHERE ao.question_id = q.id AND ao.is_correct = 1) as correct_answers
      FROM Questions q
      WHERE q.test_id = ?
      GROUP BY q.id
      ORDER BY q.order_number
    `
      )
      .all(attempt.id, testId) as any[];

    let calculatedScore = 0;
    const maxScore = questionsData.reduce((sum, q) => sum + (q.points || 0), 0);

    const questionResults = questionsData.map((q) => {
      const correctAnswers = q.correct_answers ? q.correct_answers.split(',') : [];
      const userAnswers = q.user_answers ? q.user_answers.split(',') : [];

      // Сортируем массивы для надежного сравнения
      correctAnswers.sort();
      userAnswers.sort();

      const isCorrect = correctAnswers.length > 0 && JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);

      if (isCorrect) {
        calculatedScore += q.points || 0;
      }

      return {
        question_id: q.question_id,
        question_text: q.question_text,
        user_answers: q.user_answers ? q.user_answers.split(',') : [], // Возвращаем в исходном виде
        is_correct: isCorrect,
        correct_answers: q.correct_answers ? q.correct_answers.split(',') : [],
      };
    });

    // Используем сохраненный балл, если он есть, иначе - свежепосчитанный
    const finalScore = attempt.score ?? calculatedScore;
    const passed = test.passing_score != null ? finalScore >= test.passing_score : true;

    return NextResponse.json({
      testTitle: test.title,
      score: finalScore,
      maxScore,
      passed,
      questions: questionResults,
    });
  } catch (error) {
    console.error('Server error in test result:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
