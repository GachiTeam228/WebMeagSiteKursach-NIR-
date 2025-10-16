// app/api/teachers/register/route.ts

import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

interface TeacherRegisterInfo {
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
}

export async function POST(request: Request) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    // 1. Проверка аутентификации
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

    // 2. Проверка, что запрос делает преподаватель
    const currentUser = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number } | undefined;

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    if (currentUser.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can register other teachers' }, { status: 403 });
    }

    // 3. Валидация данных запроса
    const body: TeacherRegisterInfo = await request.json();
    const { username, first_name, last_name, password, confirm_password } = body;

    // Проверка обязательных полей
    if (!username || !first_name || !last_name || !password || !confirm_password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Проверка username (только буквы, цифры, и некоторые символы)
    const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, dots, hyphens, and underscores' },
        { status: 400 }
      );
    }

    // Проверка длины username
    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({ error: 'Username must be between 3 and 50 characters' }, { status: 400 });
    }

    // Проверка имени и фамилии
    if (first_name.trim().length < 2 || last_name.trim().length < 2) {
      return NextResponse.json({ error: 'First name and last name must be at least 2 characters' }, { status: 400 });
    }

    // Проверка пароля
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    if (password !== confirm_password) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // 4. Проверка существования username
    const existingUser = db.prepare('SELECT id FROM Users WHERE username = ?').get(username) as
      | { id: number }
      | undefined;

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    // 5. Хеширование пароля
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 6. Создание нового преподавателя
    const result = db
      .prepare(
        `INSERT INTO Users (username, password_hash, first_name, last_name, role_id, is_active)
         VALUES (?, ?, ?, ?, 2, 1)`
      )
      .run(username, passwordHash, first_name.trim(), last_name.trim());

    const newTeacherId = result.lastInsertRowid;

    // 7. Получаем данные созданного преподавателя
    const newTeacher = db
      .prepare('SELECT id, username, first_name, last_name, role_id, created_at FROM Users WHERE id = ?')
      .get(newTeacherId) as {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
      role_id: number;
      created_at: string;
    };

    return NextResponse.json(
      {
        message: 'Teacher registered successfully',
        teacher: {
          id: newTeacher.id,
          username: newTeacher.username,
          first_name: newTeacher.first_name,
          last_name: newTeacher.last_name,
          role_id: newTeacher.role_id,
          created_at: newTeacher.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Teacher registration error:', error);
    return NextResponse.json({ error: 'Server error during registration' }, { status: 500 });
  }
}
