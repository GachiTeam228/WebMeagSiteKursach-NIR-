import { NextResponse } from 'next/server'
import { db } from '@lib/db'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import type { Row, AnswerOption, Chapter, Question, Test } from './types';

const SECRET = process.env.JWT_SECRET;

export async function GET(
  request: Request,
  context: any
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

    let { id } = await context.params;
    let nid = parseInt(id)

    if (isNaN(nid)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    const bebebe = db.prepare(`SELECT
    t.id AS test_id,
    t.title AS test_title,
    t.subject_id,
    t.time_limit_minutes,
    t.passing_score,
    t.deadline,
    t.is_active AS test_is_active,

    ch.id AS chapter_id,
    ch.name AS chapter_name,

    q.id AS question_id,
    q.question_text,
    q.question_type,
    q.points AS question_points,
    q.order_number AS question_order,

    ao.id AS answer_option_id,
    ao.option_text,
    ao.is_correct AS option_is_correct,
    ao.order_number AS option_order

    FROM Tests t
    LEFT JOIN Chapters ch ON ch.test_id = t.id
    LEFT JOIN Questions q ON q.test_id = t.id
    LEFT JOIN AnswerOptions ao ON ao.question_id = q.id

    WHERE t.id = ?
    ORDER BY
        ch.id,
        q.order_number,
        ao.order_number;
    `).all(nid) as Row[];

    if (!bebebe) {
      return NextResponse.json(
        { error: 'Subject not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(transformData(bebebe), { status: 200 })

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

function transformData(rows: Row[]): { chapter: Chapter } | null {
  if (rows.length === 0) return null;

  const firstRow = rows[0];

  const testData: Test = {
    test_id: firstRow.test_id,
    test_title: firstRow.test_title,
    subject_id: firstRow.subject_id,
    time_limit_minutes: firstRow.time_limit_minutes,
    passing_score: firstRow.passing_score,
    deadline: firstRow.deadline,
    is_active: Boolean(firstRow.test_is_active),
    created_at: firstRow.test_created_at,
    updated_at: firstRow.test_updated_at,
    questions: []
  };

  const chapter: Chapter = {
    id: firstRow.chapter_id,
    name: firstRow.chapter_name,
    test: testData
  };

  const questionsMap = new Map<number, Question>();

  for (const row of rows) {
    if (row.question_id == null) continue;

    if (!questionsMap.has(row.question_id)) {
      questionsMap.set(row.question_id, {
        question_id: row.question_id,
        question_text: row.question_text!,
        question_type: row.question_type!,
        points: row.question_points ?? 1,
        order_number: row.question_order,
        created_at: row.question_created_at!,
        updated_at: row.question_updated_at!,
        options: []
      });
    }

    if (row.answer_option_id != null) {
      const option: AnswerOption = {
        answer_option_id: row.answer_option_id,
        option_text: row.option_text!,
        is_correct: Boolean(row.option_is_correct),
        order_number: row.option_order
      };
      questionsMap.get(row.question_id)!.options.push(option);
    }
  }

  testData.questions = Array.from(questionsMap.values());

  return { chapter };
}
