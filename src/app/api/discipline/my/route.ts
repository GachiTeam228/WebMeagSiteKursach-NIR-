import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET() {
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

    // Получаем пользователя и проверяем, что он преподаватель
    const user = db
      .prepare('SELECT id, role_id, group_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number; group_id: number };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    // Получаем все дисциплины с количеством тестов
    const subjects =
      user.role_id == 2
        ? db
            .prepare(
              `SELECT s.id, s.name, s.created_at, 
              (SELECT COUNT(*) FROM Tests t WHERE t.subject_id = s.id) as tests
       FROM Subjects s
       WHERE s.teacher_id = ?`
            )
            .all(user.id)
        : db
            .prepare(
              `SELECT DISTINCT s.id, s.name, s.created_at, 
            (SELECT COUNT(*) FROM Tests t WHERE t.subject_id = s.id) as tests
     FROM Subjects s
     INNER JOIN Group_Subjects gs ON s.id = gs.subject_id
     WHERE gs.group_id = ?`
            )
            .all(user.group_id);

    return NextResponse.json({ subjects });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
