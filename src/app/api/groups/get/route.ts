// app/api/groups/get/route.ts

import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET() {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    // Проверка аутентификации
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Проверка роли (только преподаватели могут просматривать группы)
    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can view groups' }, { status: 403 });
    }

    // Получаем все группы с количеством студентов
    const groups = db
      .prepare(
        `SELECT 
          g.id,
          g.name,
          g.created_at,
          COUNT(u.id) as student_count
         FROM Groups g
         LEFT JOIN Users u ON g.id = u.group_id AND u.role_id = 1 AND u.is_active = 1
         GROUP BY g.id, g.name, g.created_at
         HAVING student_count > 0
         ORDER BY g.name ASC`
      )
      .all() as {
      id: number;
      name: string;
      created_at: string;
      student_count: number;
    }[];

    return NextResponse.json({
      groups,
      total: groups.length,
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
