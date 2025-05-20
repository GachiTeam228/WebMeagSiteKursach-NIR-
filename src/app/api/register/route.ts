import { NextResponse } from 'next/server'
import { db } from '@lib/db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || '';

export async function POST(request: Request) {
  try {
    const { username, password, firstName, lastName } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ message: 'Username и пароль обязательны' }, { status: 400 })
    }

    // Проверка, существует ли пользователь
    const existingUser = db.prepare('SELECT * FROM Users WHERE username = ?').get(username)
    if (existingUser) {
      return NextResponse.json({ message: 'Пользователь уже существует' }, { status: 409 })
    }

    // Хеширование пароля
    const password_hash = await bcrypt.hash(password, 10)

    // Вставка нового пользователя
    db.prepare(`
      INSERT INTO Users (username, password_hash, first_name, last_name)
      VALUES (?, ?, ?, ?)
    `).run(username, password_hash, firstName || null, lastName || null)

    // Создание токена
    const token = jwt.sign({ username }, SECRET, { expiresIn: '60h' });

    // Установка HttpOnly cookie
    (await cookies()).set('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 60,
    })

    return NextResponse.json({ message: 'Регистрация успешна' }, { status: 201 })

  } catch (error) {
    console.error('Ошибка регистрации:', error)
    return NextResponse.json({ message: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
