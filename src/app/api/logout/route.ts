import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Удаляем cookie с токеном
  (await cookies()).set('token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.json({ message: 'Вы вышли из системы' }, { status: 200 });
}