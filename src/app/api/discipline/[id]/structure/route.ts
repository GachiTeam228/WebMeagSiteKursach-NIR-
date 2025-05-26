import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!SECRET) throw new Error('JWT_SECRET env variable is not set');
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

    // Проверяем, что пользователь — преподаватель (например, role_id === 2)
    const user = db.prepare(
      'SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1'
    ).get(payload.username) as { id: number, role_id: number };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }
    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can change structure' }, { status: 403 });
    }

    const disciplineId = parseInt((await params).id, 10);
    if (isNaN(disciplineId)) {
      return NextResponse.json({ error: 'Invalid discipline id' }, { status: 400 });
    }

    const body = await request.json();
    const { chapters } = body;

    if (!Array.isArray(chapters)) {
      return NextResponse.json({ error: 'Invalid chapters format' }, { status: 400 });
    }

    // Обновляем порядок глав и тестов в транзакции
    const transaction = db.transaction(() => {
      for (const [chapterIdx, chapter] of chapters.entries()) {
        // Обновляем порядок главы
        db.prepare(
          'UPDATE Chapters SET order_number = ? WHERE id = ? AND discipline_id = ?'
        ).run(chapterIdx, chapter.id, disciplineId);

        // Обновляем порядок тестов внутри главы
        if (Array.isArray(chapter.tests)) {
          for (const [testIdx, test] of chapter.tests.entries()) {
            db.prepare(
              'UPDATE Tests SET order_number = ?, chapter_id = ? WHERE id = ?'
            ).run(testIdx, chapter.id, test.id);
          }
        }
      }
    });

    transaction();

    return NextResponse.json({ message: 'Структура дисциплины обновлена' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}