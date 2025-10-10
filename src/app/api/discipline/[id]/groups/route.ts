import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!SECRET) throw new Error('JWT_SECRET is not set');

  try {
    // 1. Авторизация и проверка роли (убедитесь, что это преподаватель)
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }
    const payload: any = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT role_id FROM Users WHERE username = ?').get(payload.username) as {
      role_id: number;
    };
    console.log(JSON.stringify(user));
    if (!user || user.role_id !== 2) {
      // Предполагаем, что роль преподавателя = 2
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Валидация входных данных
    const disciplineId = Number(params.id);
    if (isNaN(disciplineId)) {
      return NextResponse.json({ error: 'Invalid discipline ID' }, { status: 400 });
    }

    const { groupIds } = await request.json();
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return NextResponse.json({ error: 'groupIds must be a non-empty array' }, { status: 400 });
    }

    // 3. Добавление записей в таблицу Group_Subjects
    const insertStmt = db.prepare('INSERT OR IGNORE INTO Group_Subjects (group_id, subject_id) VALUES (?, ?)');

    const transaction = db.transaction((ids: number[]) => {
      for (const groupId of ids) {
        insertStmt.run(groupId, disciplineId);
      }
      return { count: ids.length };
    });

    const result = transaction(groupIds);

    return NextResponse.json({ message: `${result.count} groups added successfully.` });
  } catch (error) {
    console.error('Failed to add groups to discipline:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
