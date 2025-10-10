import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!SECRET) throw new Error('JWT_SECRET env variable is not set');
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

  const user = db
    .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
    .get(payload.username) as { id: number; role_id: number };

  if (!user) {
    return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
  }
  if (user.role_id !== 2) {
    // Предполагаем, что роль преподавателя = 2
    return NextResponse.json({ error: 'Only teachers can change structure' }, { status: 403 });
  }

  const disciplineId = Number((await params).id);
  if (isNaN(disciplineId)) {
    return NextResponse.json({ error: 'Некорректный id дисциплины' }, { status: 400 });
  }

  const { chapters } = await request.json();
  if (!Array.isArray(chapters)) {
    return NextResponse.json({ error: 'Неверный формат chapters' }, { status: 400 });
  }

  const transaction = db.transaction(() => {
    for (const chapter of chapters) {
      let currentChapterId = chapter.id;

      // Проверяем, существует ли глава
      const existingChapter = db.prepare('SELECT id FROM Chapters WHERE id = ?').get(currentChapterId);

      if (existingChapter) {
        // Если глава существует, обновляем ее порядок
        db.prepare(
          `
            UPDATE Chapters
            SET order_number = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND subject_id = ?
          `
        ).run(chapter.order, currentChapterId, disciplineId);
      } else {
        // Если главы нет, создаем новую
        // Фронтенд должен присылать 'title' для новых глав
        const result = db
          .prepare(
            `
            INSERT INTO Chapters (name, subject_id, order_number)
            VALUES (?, ?, ?)
          `
          )
          .run(chapter.title, disciplineId, chapter.order);
        currentChapterId = result.lastInsertRowid as number; // Получаем ID новой главы
      }

      if (!Array.isArray(chapter.tests)) continue;

      for (const test of chapter.tests) {
        // Проверяем, существует ли тест
        const existingTest = db.prepare('SELECT id FROM Tests WHERE id = ?').get(test.id);

        if (existingTest) {
          // Если тест существует, обновляем его порядок и привязку к главе
          db.prepare(
            `
              UPDATE Tests
              SET order_number = ?, chapter_id = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `
          ).run(test.order, currentChapterId, test.id);
        } else {
          // Если теста нет, создаем новый
          // Фронтенд должен присылать 'name' для новых тестов
          db.prepare(
            `
              INSERT INTO Tests (title, subject_id, chapter_id, order_number, deadline)
              VALUES (?, ?, ?, ?, datetime('now', '+7 days')) -- дедлайн по умолчанию
            `
          ).run(test.name, disciplineId, currentChapterId, test.order);
        }
      }
    }
  });

  try {
    transaction();
    return NextResponse.json({ message: 'Структура дисциплины обновлена' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Не удалось сохранить структуру' }, { status: 500 });
  }
}
