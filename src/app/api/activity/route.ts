import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
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
    
    // Проверяем, что пользователь — студент (role_id === 1)
    const user = db
        .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
        .get(payload.username) as { id: number; role_id: number };

    if(!user || user.role_id !== 1) {
        return NextResponse.json({ error: 'Only students can log activity' }, { status: 403 });
    }
    
    const body = await request.json();
    const { user_id, action_type, entity_id, click_count } = body;

    // Если пришел батч кликов, записываем их все сразу как одну транзакцию 
    // с весом = click_count (или делаем N записей)
    const clicksToRecord = click_count || 1;

    const stmt = db.prepare(`
      INSERT INTO Activity_Logs (user_id, action_type, entity_id) 
      VALUES (?, ?, ?)
    `);

    // Используем транзакцию для безопасности и скорости
    const insertMany = db.transaction((count: number) => {
      for (let i = 0; i < count; i++) {
        stmt.run(user_id, action_type, entity_id || null);
      }
    });

    insertMany(clicksToRecord);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activity API Error:', error);
    return NextResponse.json({ error: 'Ошибка логирования' }, { status: 500 });
  }
}