import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }
    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can create chapters' }, { status: 403 });
    }

    const disciplineId = parseInt((await params).id, 10);
    if (isNaN(disciplineId)) {
      return NextResponse.json({ error: 'Invalid discipline id' }, { status: 400 });
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Invalid chapter title' }, { status: 400 });
    }

    // Вставляем новую главу
    const result = db
      .prepare('INSERT INTO Chapters (discipline_id, name) VALUES (?, ?)')
      .run(disciplineId, title.trim());

    return NextResponse.json({
      message: 'Chapter created',
      chapter_id: result.lastInsertRowid,
      title: title.trim(),
      discipline_id: disciplineId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
