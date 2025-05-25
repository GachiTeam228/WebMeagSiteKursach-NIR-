import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET() {
    if (!SECRET) {
        throw new Error('no jwt')
    }
    try {
        // Получаем токен из cookie
        const token = (await cookies()).get('token')?.value;
        if (!token) {
            return NextResponse.json({ isAdmin: false, error: 'No token' }, { status: 401 });
        }

        // Декодируем токен
        let payload: any;
        try {
            payload = jwt.verify(token, SECRET)
        } catch {
            return NextResponse.json({ isAdmin: false, error: 'Invalid token' }, { status: 401 });
        }

        // Получаем пользователя и его роль
        const user = db.prepare(`
            SELECT Users.username, Roles.is_admin
            FROM Users
            LEFT JOIN Roles ON Users.role_id = Roles.id
            WHERE Users.username = ?
        `).get(payload.username) as { is_admin: string }

        if (!user) {
            return NextResponse.json({ isAdmin: false, error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ isAdmin: !!user.is_admin });
    } catch (error) {
        return NextResponse.json({ isAdmin: false, error: 'Server error' }, { status: 500 });
    }
}