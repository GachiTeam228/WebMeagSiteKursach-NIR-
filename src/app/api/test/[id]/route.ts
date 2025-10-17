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
  image_url?: string | null; // Добавлено
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

    const payload: any = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT role_id FROM Users WHERE id = ?').get(payload.id) as { role_id: number };
    const isTeacher = user?.role_id === 2;

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

    // Получение вопросов с image_url
    const questions = db
      .prepare(
        `
      SELECT id, question_text, question_type, points, order_number, image_url
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

    // Сборка финального объекта с учетом роли
    const questionsWithOptions = questions.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      points: q.points,
      order_number: q.order_number,
      image_url: q.image_url, // Добавлено
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
        // Обновленный SQL с поддержкой image_url
        const insertQuestionStmt = db.prepare(`
          INSERT INTO Questions (test_id, question_text, question_type, points, order_number, image_url)
          VALUES (?, ?, ?, ?, ?, ?)
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
            q.order_number,
            q.image_url || null // Добавлено
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
