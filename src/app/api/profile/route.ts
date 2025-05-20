import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@lib/db'

const SECRET = process.env.JWT_SECRET || 'secret123'

export async function GET() {
  try {
    const cookieStore = await cookies(); // ✅ не await
    const tokena = cookieStore.get('token');

    if (!tokena) {
      return NextResponse.json({ message: 'Нет токена' }, { status: 401 });
    }

    const token = tokena.value;
    const decoded = jwt.verify(token, SECRET) as { username: string }

    const user = db.prepare(`
      SELECT id, username, first_name, last_name, role_id, group_id 
      FROM Users WHERE username = ?
    `).get(decoded.username)

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }

    return NextResponse.json(user, { status: 200 })

  } catch (err) {
    console.error('Ошибка профиля:', err)
    return NextResponse.json({ message: 'Ошибка авторизации' }, { status: 401 })
  }
}
