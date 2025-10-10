import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
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

    // Получаем данные из запроса
    const body = await request.json();
    const { currentPass, newPass, confirmNewPass } = body;

    // Валидация входных данных
    if (!currentPass || !newPass || !confirmNewPass) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (newPass !== confirmNewPass) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 });
    }

    if (newPass.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    // Получаем пользователя из БД
    const user = db
      .prepare('SELECT id, username, password_hash FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; username: string; password_hash: string } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    // Проверяем текущий пароль
    const isPasswordValid = await bcrypt.compare(currentPass, user.password_hash);

    if (!isPasswordValid && currentPass !== user.password_hash) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Хешируем новый пароль
    const saltRounds = 10;
    const newPassHash = await bcrypt.hash(newPass, saltRounds);

    // Обновляем пароль в БД
    db.prepare('UPDATE Users SET password_hash = ? WHERE id = ?').run(newPassHash, user.id);

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
