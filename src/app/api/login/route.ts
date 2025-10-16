import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from '@lib/db'; // Предполагаем, что у вас есть этот файл

interface User {
  id: number;
  username: string;
  password_hash: string;
  role_id: string; // Используем более общее поле роли
}

const SECRET = process.env.JWT_SECRET;

export async function POST(req: Request) {
  if (!SECRET) {
    throw new Error('JWT_SECRET не определен в .env');
  }
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Имя пользователя и пароль обязательны' }, { status: 400 });
    }

    // Поиск пользователя и его роли в БД
    const user = db.prepare(`SELECT * FROM Users WHERE username = ? AND is_active = 1`).get(username) as User;

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден или неактивен' }, { status: 401 });
    }

    // Проверка пароля
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch && user.password_hash !== password) {
      return NextResponse.json({ message: 'Неверный пароль' }, { status: 401 });
    }

    // Генерация токена с ролью
    const token = jwt.sign({ username: user.username, role: user.role_id, id: user.id }, SECRET, { expiresIn: '7d' });

    // Установка cookie
    (await cookies()).set('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json({ message: 'Вход успешен', role: user.role_id }, { status: 200 });
  } catch (err) {
    console.error('Ошибка логина:', err);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
