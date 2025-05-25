import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@lib/db'

const SECRET = process.env.JWT_SECRET;

export async function GET() {
  if (!SECRET) {
    throw new Error('no jwt')
  }
  try {
    const cookieStore = await cookies();
    const tokena = cookieStore.get('token');

    if (!tokena) {
      return NextResponse.json({ message: 'Нет токена' }, { status: 401 });
    }

    const token = tokena.value;
    const decoded = jwt.verify(token, SECRET) as { username: string }

    // Получаем пользователя
    const user = db.prepare(`
      SELECT id, username, first_name, last_name, role_id, group_id 
      FROM Users WHERE username = ?
    `).get(decoded.username) as {id: number, username: string, first_name: string, last_name: string, role_id: number, group_id: number}

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }

    // Получаем название группы, если есть group_id
    let group_name = null;
    try{
    const group = db.prepare('SELECT name FROM Groups WHERE id = ?').get(user.group_id) as {name: string};
    group_name = group !== null ? group.name : user.group_id;
    } catch (err) {}

    // Возвращаем профиль с group_name вместо group_id
    return NextResponse.json({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role_id: user.role_id,
      group: group_name
    }, { status: 200 })

  } catch (err) {
    console.error('Ошибка профиля:', err)
    return NextResponse.json({ message: 'Ошибка авторизации' }, { status: 401 })
  }
}
