// app/api/groups/add/route.ts

import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

interface AddGroupBody {
  group_id: number;
}

// Добавить группу к текущему преподавателю
export async function POST(request: Request) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
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

    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can add groups' }, { status: 403 });
    }

    const body: AddGroupBody = await request.json();
    const { group_id } = body;

    if (!group_id || isNaN(group_id)) {
      return NextResponse.json({ error: 'Invalid group_id' }, { status: 400 });
    }

    // Проверяем, существует ли группа
    const group = db.prepare('SELECT id, name FROM Groups WHERE id = ?').get(group_id) as
      | { id: number; name: string }
      | undefined;

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Проверяем, не добавлена ли уже эта группа
    const existing = db
      .prepare('SELECT teacher_id FROM Teachers_Groups WHERE teacher_id = ? AND group_id = ?')
      .get(user.id, group_id) as { teacher_id: number } | undefined;

    if (existing) {
      return NextResponse.json({ error: 'Group already assigned to you' }, { status: 409 });
    }

    // Добавляем связь
    db.prepare('INSERT INTO Teachers_Groups (teacher_id, group_id) VALUES (?, ?)').run(user.id, group_id);

    return NextResponse.json(
      {
        message: 'Group successfully added',
        group: {
          id: group.id,
          name: group.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding group:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Получить все группы текущего преподавателя
export async function GET() {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
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

    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can view groups' }, { status: 403 });
    }

    // Получаем все группы преподавателя
    const groups = db
      .prepare(
        `SELECT 
          g.id,
          g.name,
          g.created_at,
          COUNT(u.id) as student_count
         FROM Groups g
         JOIN Teachers_Groups tg ON g.id = tg.group_id
         LEFT JOIN Users u ON g.id = u.group_id AND u.role_id = 1 AND u.is_active = 1
         WHERE tg.teacher_id = ?
         GROUP BY g.id, g.name, g.created_at
         ORDER BY g.name ASC`
      )
      .all(user.id) as {
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

// Удалить группу у текущего преподавателя
export async function DELETE(request: Request) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
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

    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can remove groups' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = Number(searchParams.get('group_id'));

    if (isNaN(groupId)) {
      return NextResponse.json({ error: 'Invalid group_id' }, { status: 400 });
    }

    const result = db
      .prepare('DELETE FROM Teachers_Groups WHERE teacher_id = ? AND group_id = ?')
      .run(user.id, groupId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Group not assigned to you' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Group successfully removed',
    });
  } catch (error) {
    console.error('Error removing group:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
