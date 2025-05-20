import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from '@lib/db';

interface User {
    id: number,
    username: string,
    password_hash: string,
    first_name?: string,
    last_name?: string,
    created_at: string,
    is_active: boolean
}

const SECRET = process.env.JWT_SECRET || 'secret123';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Имя пользователя и пароль обязательны' }, { status: 400 });
    }

    // Поиск пользователя в БД
    const user = db
      .prepare('SELECT * FROM Users WHERE username = ? AND is_active = 1')
      .get(username) as User;

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден или неактивен' }, { status: 401 });
    }

    // Проверка пароля
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ message: 'Неверный пароль' }, { status: 401 });
    }

    // Генерация токена
    const token = jwt.sign({ username: user.username }, SECRET, { expiresIn: '60h' });

    // Установка cookie
    (await cookies()).set('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 60, // 1 час
      sameSite: 'lax', // предотвращает CSRF
      secure: process.env.NODE_ENV === 'production', // только https в проде
    });

    return NextResponse.json({ message: 'Вход успешен' }, { status: 200 });

  } catch (err) {
    console.error('Ошибка логина:', err);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
