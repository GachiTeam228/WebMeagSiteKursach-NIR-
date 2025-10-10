import { NextResponse } from 'next/server'
import { db } from '@lib/db'
import jwt from 'jsonwebtoken'
import type { Row, Test, Chapter, Question, AnswerOption } from './types';
import { cookies } from 'next/headers'

const SECRET = process.env.JWT_SECRET;

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  if (!SECRET) {
    throw new Error('JWT_SECRET env variable is not set');
  }
  try {
    // --- Проверка авторизации ---
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
    // --- Конец проверки авторизации ---

    // params.id может быть промисом, поэтому await
    const { id } = await context.params;
    const nid = parseInt(id);

    if (isNaN(nid)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Получаем тест, главы, вопросы и варианты ответов
    const rows = db.prepare(`
      SELECT
        t.id AS test_id,
        t.title AS test_title,
        t.subject_id,
        t.time_limit_minutes,
        t.passing_score,
        t.deadline,
        t.order_number AS test_order,
        t.is_active AS test_is_active,
        t.created_at AS test_created_at,
        t.updated_at AS test_updated_at,

        ch.id AS chapter_id,
        ch.name AS chapter_name,
        ch.order_number AS chapter_order,

        q.id AS question_id,
        q.question_text,
        q.question_type,
        q.points AS question_points,
        q.order_number AS question_order,
        q.created_at AS question_created_at,
        q.updated_at AS question_updated_at,

        ao.id AS answer_option_id,
        ao.option_text,
        ao.is_correct AS option_is_correct,
        ao.order_number AS option_order

      FROM Tests t
      LEFT JOIN Chapters ch ON ch.subject_id = t.subject_id
      LEFT JOIN Questions q ON q.test_id = t.id
      LEFT JOIN AnswerOptions ao ON ao.question_id = q.id

      WHERE t.id = ?
      ORDER BY
        ch.order_number,
        q.order_number,
        ao.order_number
    `).all(nid) as Row[];

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Трансформируем данные в иерархическую структуру
    const test: Test = {
      id: rows[0].test_id,
      title: rows[0].test_title,
      subject_id: rows[0].subject_id,
      time_limit_minutes: rows[0].time_limit_minutes,
      passing_score: rows[0].passing_score,
      deadline: rows[0].deadline,
      order_number: rows[0].test_order,
      is_active: Boolean(rows[0].test_is_active),
      created_at: rows[0].test_created_at,
      updated_at: rows[0].test_updated_at,
      chapters: [],
      questions: [],
    };

    const chaptersMap = new Map<number, Chapter>();
    const questionsMap = new Map<number, Question>();

    for (const row of rows) {
      // Главы (Chapters)
      if (row.chapter_id && !chaptersMap.has(row.chapter_id)) {
        chaptersMap.set(row.chapter_id, {
          id: row.chapter_id,
          subject_id: test.subject_id,
          name: row.chapter_name ?? "",
          order_number: row.chapter_order,
        });
      }

      // Вопросы (Questions)
      if (row.question_id && !questionsMap.has(row.question_id)) {
        questionsMap.set(row.question_id, {
          id: row.question_id,
          test_id: test.id,
          question_text: row.question_text ?? "",
          question_type: row.question_type ?? "single",
          points: row.question_points ?? 1,
          order_number: row.question_order,
          created_at: row.question_created_at ?? "",
          updated_at: row.question_updated_at ?? "",
          answer_options: []
        });
      }

      // Варианты ответов (AnswerOptions)
      if (row.answer_option_id && row.question_id && questionsMap.has(row.question_id)) {
        (questionsMap.get(row.question_id) as Question).answer_options.push({
          id: row.answer_option_id,
          question_id: row.question_id,
          option_text: row.option_text ?? "",
          is_correct: Boolean(row.option_is_correct),
          order_number: row.option_order
        });
      }
    }

    // Привязываем вопросы к тесту (в вашей схеме вопросы не связаны с главами напрямую)
    test.questions = Array.from(questionsMap.values()).sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
    test.chapters = Array.from(chaptersMap.values()).sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));

    return NextResponse.json(test, { status: 200 });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
