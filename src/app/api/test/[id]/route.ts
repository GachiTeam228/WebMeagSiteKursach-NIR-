import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

// Типы для данных из запроса на сохранение
interface AnswerOptionData {
  id?: number;
  option_text: string;
  is_correct: boolean;
}

interface QuestionData {
  id?: number;
  question_text: string;
  question_type: 'single' | 'multiple' | 'text';
  points: number;
  order_number: number;
  options: AnswerOptionData[];
}

interface TestData {
  title: string;
  time_limit_minutes: number | null;
  passing_score: number | null;
  questions: QuestionData[];
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    // --- ИЗМЕНЕНИЕ: Получаем роль пользователя ---
    const payload: any = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT role_id FROM Users WHERE id = ?').get(payload.id) as { role_id: number };
    const isTeacher = user?.role_id === 2; // Предполагаем, что роль преподавателя = 2

    const testId = Number((await params).id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test ID' }, { status: 400 });
    }

    // Получение основной информации о тесте
    const test = db
      .prepare(
        `
      SELECT
        t.id,
        t.title,
        t.time_limit_minutes,
        t.passing_score,
        c.name as chapter_name
      FROM Tests t
      LEFT JOIN Chapters c ON t.chapter_id = c.id
      WHERE t.id = ?
    `
      )
      .get(testId);

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Получение вопросов
    const questions = db
      .prepare(
        `
      SELECT id, question_text, question_type, points, order_number
      FROM Questions
      WHERE test_id = ?
      ORDER BY order_number
    `
      )
      .all(testId);

    const questionIds = questions.map((q: any) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      const optionsQuery = `
        SELECT id, question_id, option_text, is_correct
        FROM AnswerOptions
        WHERE question_id IN (${questionIds.map(() => '?').join(',')})
      `;
      options = db.prepare(optionsQuery).all(...questionIds);
    }

    // --- ИЗМЕНЕНИЕ: Сборка финального объекта с учетом роли ---
    const questionsWithOptions = questions.map((q: any) => ({
      ...q,
      options: options
        .filter((opt) => opt.question_id === q.id)
        .map((opt) => {
          const optionData: any = {
            id: opt.id,
            question_id: opt.question_id,
            option_text: opt.option_text,
          };
          // Добавляем is_correct только для преподавателя
          if (isTeacher) {
            optionData.is_correct = Boolean(opt.is_correct);
          }
          return optionData;
        }),
    }));

    return NextResponse.json({ ...test, questions: questionsWithOptions });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    console.error('Failed to fetch test:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const payload: any = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT role_id FROM Users WHERE id = ?').get(payload.id) as { role_id: number };

    if (!user || user.role_id !== 2) {
      // Роль преподавателя = 2
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const testId = Number((await params).id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test ID' }, { status: 400 });
    }

    const body: TestData = await request.json();
    const { title, time_limit_minutes, passing_score, questions } = body;

    if (!title || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Invalid request body format' }, { status: 400 });
    }

    const transaction = db.transaction(() => {
      db.prepare(
        `
        UPDATE Tests
        SET title = ?, time_limit_minutes = ?, passing_score = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(title, time_limit_minutes, passing_score, testId);

      db.prepare('DELETE FROM Questions WHERE test_id = ?').run(testId);

      if (questions.length > 0) {
        const insertQuestionStmt = db.prepare(`
          INSERT INTO Questions (test_id, question_text, question_type, points, order_number)
          VALUES (?, ?, ?, ?, ?)
        `);
        const insertOptionStmt = db.prepare(`
          INSERT INTO AnswerOptions (question_id, option_text, is_correct)
          VALUES (?, ?, ?)
        `);

        for (const q of questions) {
          const questionResult = insertQuestionStmt.run(
            testId,
            q.question_text,
            q.question_type,
            q.points,
            q.order_number
          );
          const newQuestionId = questionResult.lastInsertRowid;

          if (q.options && q.options.length > 0) {
            for (const opt of q.options) {
              insertOptionStmt.run(newQuestionId, opt.option_text, opt.is_correct ? 1 : 0);
            }
          }
        }
      }
    });

    transaction();
    return NextResponse.json({ message: 'Тест успешно обновлен' });
  } catch (error) {
    console.error('Failed to update test:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// import { NextResponse } from 'next/server'
// import { db } from '@lib/db'
// import jwt from 'jsonwebtoken'
// import type { Row, Test, Chapter, Question, AnswerOption } from './types';
// import { cookies } from 'next/headers'

// const SECRET = process.env.JWT_SECRET;

// export async function GET(
//   request: Request,
//   context: { params: { id: string } }
// ) {
//   if (!SECRET) {
//     throw new Error('JWT_SECRET env variable is not set');
//   }
//   try {
//     // --- Проверка авторизации ---
//     const token = (await cookies()).get('token')?.value;
//     if (!token) {
//       return NextResponse.json({ error: 'No token' }, { status: 401 });
//     }
//     let payload: any;
//     try {
//       payload = jwt.verify(token, SECRET);
//     } catch {
//       return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
//     }
//     // --- Конец проверки авторизации ---

//     // params.id может быть промисом, поэтому await
//     const { id } = await context.params;
//     const nid = parseInt(id);

//     if (isNaN(nid)) {
//       return NextResponse.json(
//         { error: 'Invalid ID format' },
//         { status: 400 }
//       );
//     }

//     // Получаем тест, главы, вопросы и варианты ответов
//     const rows = db.prepare(`
//       SELECT
//         t.id AS test_id,
//         t.title AS test_title,
//         t.subject_id,
//         t.time_limit_minutes,
//         t.passing_score,
//         t.deadline,
//         t.order_number AS test_order,
//         t.is_active AS test_is_active,
//         t.created_at AS test_created_at,
//         t.updated_at AS test_updated_at,

//         ch.id AS chapter_id,
//         ch.name AS chapter_name,
//         ch.order_number AS chapter_order,

//         q.id AS question_id,
//         q.question_text,
//         q.question_type,
//         q.points AS question_points,
//         q.order_number AS question_order,
//         q.created_at AS question_created_at,
//         q.updated_at AS question_updated_at,

//         ao.id AS answer_option_id,
//         ao.option_text,
//         ao.is_correct AS option_is_correct,
//         ao.order_number AS option_order

//       FROM Tests t
//       LEFT JOIN Chapters ch ON ch.subject_id = t.subject_id
//       LEFT JOIN Questions q ON q.test_id = t.id
//       LEFT JOIN AnswerOptions ao ON ao.question_id = q.id

//       WHERE t.id = ?
//       ORDER BY
//         ch.order_number,
//         q.order_number,
//         ao.order_number
//     `).all(nid) as Row[];

//     if (!rows || rows.length === 0) {
//       return NextResponse.json(
//         { error: 'Test not found' },
//         { status: 404 }
//       );
//     }

//     // Трансформируем данные в иерархическую структуру
//     const test: Test = {
//       id: rows[0].test_id,
//       title: rows[0].test_title,
//       subject_id: rows[0].subject_id,
//       time_limit_minutes: rows[0].time_limit_minutes,
//       passing_score: rows[0].passing_score,
//       deadline: rows[0].deadline,
//       order_number: rows[0].test_order,
//       is_active: Boolean(rows[0].test_is_active),
//       created_at: rows[0].test_created_at,
//       updated_at: rows[0].test_updated_at,
//       chapters: [],
//       questions: [],
//     };

//     const chaptersMap = new Map<number, Chapter>();
//     const questionsMap = new Map<number, Question>();

//     for (const row of rows) {
//       // Главы (Chapters)
//       if (row.chapter_id && !chaptersMap.has(row.chapter_id)) {
//         chaptersMap.set(row.chapter_id, {
//           id: row.chapter_id,
//           subject_id: test.subject_id,
//           name: row.chapter_name ?? "",
//           order_number: row.chapter_order,
//         });
//       }

//       // Вопросы (Questions)
//       if (row.question_id && !questionsMap.has(row.question_id)) {
//         questionsMap.set(row.question_id, {
//           id: row.question_id,
//           test_id: test.id,
//           question_text: row.question_text ?? "",
//           question_type: row.question_type ?? "single",
//           points: row.question_points ?? 1,
//           order_number: row.question_order,
//           created_at: row.question_created_at ?? "",
//           updated_at: row.question_updated_at ?? "",
//           answer_options: []
//         });
//       }

//       // Варианты ответов (AnswerOptions)
//       if (row.answer_option_id && row.question_id && questionsMap.has(row.question_id)) {
//         (questionsMap.get(row.question_id) as Question).answer_options.push({
//           id: row.answer_option_id,
//           question_id: row.question_id,
//           option_text: row.option_text ?? "",
//           is_correct: Boolean(row.option_is_correct),
//           order_number: row.option_order
//         });
//       }
//     }

//     // Привязываем вопросы к тесту (в вашей схеме вопросы не связаны с главами напрямую)
//     test.questions = Array.from(questionsMap.values()).sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
//     test.chapters = Array.from(chaptersMap.values()).sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));

//     return NextResponse.json(test, { status: 200 });

//   } catch (error) {
//     console.error('Database error:', error);
//     return NextResponse.json(
//       { error: 'Internal Server Error' },
//       { status: 500 }
//     );
//   }
// }
