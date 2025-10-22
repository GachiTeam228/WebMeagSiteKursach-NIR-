import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number };

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
    const attempt = db
      .prepare(`SELECT id FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 0`)
      .get(user.id, testId) as { id: number } | undefined;

    if (!attempt) {
      return NextResponse.json({ error: 'No active attempt found' }, { status: 404 });
    }

    // Ищем НЕЗАВЕРШЁННЫЙ assignment, связанный с этой попыткой
    const testAssignment = db
      .prepare(
        `SELECT id, is_completed FROM TestAssignments 
         WHERE test_id = ? AND user_id = ? AND is_completed = 0
         ORDER BY deadline ASC
         LIMIT 1`
      )
      .get(testId, user.id) as { id: number; is_completed: number } | undefined;

    if (!testAssignment) {
      // Если нет незавершённого assignment, значит все завершены или тест не назначен
      // Но мы всё равно можем завершить попытку без обновления assignment
      console.warn(`No active assignment found for user ${user.id}, test ${testId}, but attempt exists`);
    }

    // --- Считаем результат по баллам (points) ---

    // 1. Получаем все вопросы теста вместе с баллами за них
    const questions = db.prepare(`SELECT id, question_type, points FROM Questions WHERE test_id = ?`).all(testId) as {
      id: number;
      question_type: string;
      points: number;
    }[];

    // 2. Получаем все ответы пользователя по попытке
    const userAnswers = db
      .prepare(`SELECT question_id, answer_option_id FROM UserAnswers WHERE attempt_id = ?`)
      .all(attempt.id) as { question_id: number; answer_option_id: number }[];

    // 3. Получаем все правильные варианты для вопросов теста
    const correctOptions = db
      .prepare(
        `SELECT question_id, id as answer_option_id FROM AnswerOptions WHERE question_id IN (
          SELECT id FROM Questions WHERE test_id = ?
       ) AND is_correct = 1`
      )
      .all(testId) as { question_id: number; answer_option_id: number }[];

    // Группируем ответы по вопросам для удобного сравнения
    const userAnswersMap = new Map<number, number[]>();
    userAnswers.forEach((a) => {
      if (!userAnswersMap.has(a.question_id)) userAnswersMap.set(a.question_id, []);
      userAnswersMap.get(a.question_id)!.push(a.answer_option_id);
    });
    const correctOptionsMap = new Map<number, number[]>();
    correctOptions.forEach((a) => {
      if (!correctOptionsMap.has(a.question_id)) correctOptionsMap.set(a.question_id, []);
      correctOptionsMap.get(a.question_id)!.push(a.answer_option_id);
    });

    // 4. Подсчёт итогового балла
    let totalScore = 0;
    for (const q of questions) {
      const userAns = userAnswersMap.get(q.id) || [];
      const correctAns = correctOptionsMap.get(q.id) || [];

      // Сортируем массивы для надежного сравнения, независимо от порядка
      userAns.sort();
      correctAns.sort();

      const isCorrect = JSON.stringify(userAns) === JSON.stringify(correctAns);

      if (isCorrect) {
        // Если ответ верный, добавляем баллы за этот вопрос к общему счету
        totalScore += q.points || 0;
      }
    }

    // 5. Получаем passing_score (проходной балл) из Tests
    const test = db.prepare(`SELECT passing_score FROM Tests WHERE id = ?`).get(testId) as
      | { passing_score: number | null }
      | undefined;

    const passingScore = test?.passing_score || 0;

    // 6. Определяем, прошёл ли студент тест
    const isPassed = totalScore >= passingScore;

    // 7. Завершаем попытку, фиксируя время окончания и посчитанный балл
    db.prepare(
      `UPDATE Attempts SET is_completed = 1, end_time = datetime('now', 'localtime'), score = ? WHERE id = ?`
    ).run(totalScore, attempt.id);

    // 8. Если тест пройден успешно И есть активный assignment, обновляем его
    if (isPassed && testAssignment) {
      db.prepare(`UPDATE TestAssignments SET is_completed = 1 WHERE id = ?`).run(testAssignment.id);
    }

    return NextResponse.json({
      message: 'Test attempt completed',
      attempt_id: attempt.id,
      score: totalScore,
      passing_score: passingScore,
      passed: isPassed,
      assignment_completed: isPassed && testAssignment !== undefined,
    });
  } catch (error) {
    console.error('Error ending test attempt:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
