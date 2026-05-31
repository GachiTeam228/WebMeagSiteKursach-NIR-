import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

// Типы для данных из запроса
interface AnswerOptionData {
  option_text: string;
  is_correct: boolean;
}

interface QuestionData {
  question_text: string;
  question_type: 'single' | 'multiple' | 'text';
  points: number;
  order_number: number;
  image_url?: string | null; // Добавлено поле для изображения
  options?: AnswerOptionData[];
  tags?: string[];
}

interface TestData {
  title: string;
  time_limit_minutes: number | null;
  passing_score: number | null;
  deadline: string;
  questions: QuestionData[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    // 1. Авторизация и проверка роли
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

    // 2. Валидация ID теста и данных
    const testId = Number((await params).id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test ID' }, { status: 400 });
    }

    const body: TestData = await request.json();
    const { title, time_limit_minutes, passing_score, questions } = body;

    if (!title || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Invalid request body format' }, { status: 400 });
    }

    const insertTagStmt = db.prepare('INSERT OR IGNORE INTO Tags (name) VALUES (?)');
    const selectTagStmt = db.prepare('SELECT id FROM Tags WHERE name = ?');
    const insertQuestionTagStmt = db.prepare(
      'INSERT OR IGNORE INTO Question_Tags (question_id, tag_id) VALUES (?, ?)'
    );

    // 3. Выполнение операции в транзакции
    const transaction = db.transaction(() => {
      // Шаг 1: Обновить основные данные теста
      db.prepare(
        `
        UPDATE Tests
        SET
          title = ?,
          time_limit_minutes = ?,
          passing_score = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(title, time_limit_minutes, passing_score, testId);

      // Шаг 2: Удалить все существующие вопросы (и их ответы через ON DELETE CASCADE)
      db.prepare('DELETE FROM Questions WHERE test_id = ?').run(testId);

      // Шаг 3: Вставить новые вопросы и их ответы
      if (questions.length > 0) {
        // Обновленный SQL запрос с поддержкой image_url
        const insertQuestionStmt = db.prepare(`
          INSERT INTO Questions (test_id, question_text, question_type, points, order_number, image_url)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertOptionStmt = db.prepare(`
          INSERT INTO AnswerOptions (question_id, option_text, is_correct)
          VALUES (?, ?, ?)
        `);

        for (const q of questions) {
          // Вставляем вопрос с image_url
          const questionResult = insertQuestionStmt.run(
            testId,
            q.question_text,
            q.question_type,
            q.points,
            q.order_number,
            q.image_url || null // Если image_url не указан, сохраняем NULL
          );
          const newQuestionId = questionResult.lastInsertRowid;

          // Вставляем варианты ответов
          if (q.options && q.options.length > 0) {
            for (const opt of q.options) {
              insertOptionStmt.run(newQuestionId, opt.option_text, opt.is_correct ? 1 : 0);
            }
          }

          if (Array.isArray(q.tags)) {
            for (const rawTag of q.tags) {
              const tagName = String(rawTag || '').trim();
              if (!tagName) continue;
              insertTagStmt.run(tagName);
              const tagRow = selectTagStmt.get(tagName) as { id: number } | undefined;
              if (tagRow) {
                insertQuestionTagStmt.run(newQuestionId, tagRow.id);
              }
            }
          }
        }
      }
    });

    transaction();

    return NextResponse.json({ message: 'Тест успешно обновлен' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    console.error('Failed to update test:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
