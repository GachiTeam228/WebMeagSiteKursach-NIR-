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

    // Проверяем, что пользователь админ
    const user = db
      .prepare(
        `
      SELECT Users.id, Roles.is_admin
      FROM Users
      LEFT JOIN Roles ON Users.role_id = Roles.id
      WHERE Users.username = ?
    `
      )
      .get(payload.username) as { id: number; is_admin: boolean };

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: not admin' }, { status: 403 });
    }

    const subjectId = parseInt(params.id, 10);
    if (isNaN(subjectId)) {
      return NextResponse.json({ error: 'Invalid subject id' }, { status: 400 });
    }

    const body = await request.json();
    const { group_id } = body;

    if (!group_id || typeof group_id !== 'number') {
      return NextResponse.json({ error: 'Invalid group_id' }, { status: 400 });
    }

    // Проверяем, что предмет и группа существуют
    const subject = db.prepare('SELECT id FROM Subjects WHERE id = ?').get(subjectId);
    const group = db.prepare('SELECT id FROM Groups WHERE id = ?').get(group_id);

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Добавляем связь (предполагается таблица Group_Subjects)
    db.prepare('INSERT INTO Group_Subjects (group_id, subject_id) VALUES (?, ?)').run(group_id, subjectId);

    return NextResponse.json({ message: 'Group added to subject', subject_id: subjectId, group_id });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json({ error: 'Связь уже существует' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
