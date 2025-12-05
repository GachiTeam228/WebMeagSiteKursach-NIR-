import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Генерируем уникальное имя файла
    const ext = file.name.split('.').pop();
    const fileName = `answer_option_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'answer-options');
    const filePath = path.join(uploadDir, fileName);

    // Создаем папку, если её нет
    await import('fs').then((fs) => {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    });

    // Сохраняем файл
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Возвращаем публичный URL
    const publicUrl = `/uploads/answer-options/${fileName}`;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
