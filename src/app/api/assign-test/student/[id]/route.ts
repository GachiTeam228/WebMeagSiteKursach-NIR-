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

    // Проверяем, что пользователь — преподаватель (role_id === 2)
    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number };

    if (!user || user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can assign tests' }, { status: 403 });
    }

    const studentId = parseInt((await params).id, 10);
    if (isNaN(studentId)) {
      return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });
    }

    const body = await request.json();
    const { test_id, deadline } = body;

    if (!test_id || typeof test_id !== 'number') {
      return NextResponse.json({ error: 'Invalid test id' }, { status: 400 });
    }

    // Проверяем, существует ли студент
    const student = db.prepare('SELECT id FROM Users WHERE id = ? AND role_id = 1 AND is_active = 1').get(studentId);

    if (!student) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 404 });
    }

    // Проверяем, существует ли тест
    const test = db.prepare('SELECT id FROM Tests WHERE id = ?').get(test_id);

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Выдаём тест студенту (создаём запись в TestAssignments)
    db.prepare(
      `INSERT INTO TestAssignments (test_id, user_id, is_completed, deadline)
       VALUES (?, ?, 0, ?)`
    ).run(test_id, studentId, deadline || null);

    return NextResponse.json({ message: 'Тест выдан студенту', test_id, student_id: studentId });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return NextResponse.json({ error: 'Тест уже выдан этому студенту' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
