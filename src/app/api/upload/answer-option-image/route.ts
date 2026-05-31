import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from '@lib/db';

const SECRET = process.env.JWT_SECRET;

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

    // 2. Проверка роли пользователя
    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    // Только преподаватели (role_id = 2) могут загружать изображения вариантов ответов
    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can upload answer option images' }, { status: 403 });
    }

    // 3. Получаем данные формы
    const data = await request.formData();
    const file = data.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 4. Генерируем уникальное имя файла
    const ext = file.name.split('.').pop();
    const fileName = `answer_option_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'answer-options');
    const filePath = path.join(uploadDir, fileName);

    // 5. Создаем папку, если её нет
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 6. Сохраняем файл
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    console.log(`Answer option image uploaded by teacher ${user.id}: ${fileName}`);

    // 7. Возвращаем публичный URL
    const publicUrl = `/uploads/answer-options/${fileName}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

