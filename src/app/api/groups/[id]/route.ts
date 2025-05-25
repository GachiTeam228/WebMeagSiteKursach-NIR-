import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!SECRET) {
    throw new Error('no jwt');
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

    // Проверяем, что пользователь существует и активен по username
    const user = db.prepare(
      'SELECT id FROM Users WHERE username = ? AND is_active = 1'
    ).get(payload.username);

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    const groupId = parseInt(params.id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
    }

    // Получаем группу
    const group = db.prepare(
      'SELECT id, name, created_at FROM Groups WHERE id = ?'
    ).get(groupId) as { id: number, name: string, created_at: string };

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Получаем студентов группы
    const students = db.prepare(
      'SELECT id, username, first_name, last_name FROM Users WHERE group_id = ?'
    ).all(groupId);

    return NextResponse.json({
      id: group.id,
      name: group.name,
      created_at: group.created_at,
      students,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}