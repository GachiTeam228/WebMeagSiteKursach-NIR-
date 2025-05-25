import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
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
    const user = db.prepare(`
      SELECT Users.id, Roles.is_admin
      FROM Users
      LEFT JOIN Roles ON Users.role_id = Roles.id
      WHERE Users.username = ?
    `).get(payload.username) as {id: number, is_admin: boolean};

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: not admin' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Invalid subject name' }, { status: 400 });
    }

    // Создаём предмет
    const result = db.prepare(
      'INSERT INTO Subjects (name) VALUES (?)'
    ).run(name.trim());

    return NextResponse.json({ message: 'Subject created', subject_id: result.lastInsertRowid, name: name.trim() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}