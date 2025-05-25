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
        // --- 1. Проверка токена и роли ---
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

        // Получаем пользователя и его роль
        const user = db.prepare(`
            SELECT Users.id, Roles.is_admin
            FROM Users
            LEFT JOIN Roles ON Users.role_id = Roles.id
            WHERE Users.username = ?
        `).get(payload.username) as { id: number, is_admin: number, username: string };

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (!user.is_admin) {
            return NextResponse.json({ error: 'Forbidden: not admin' }, { status: 403 });
        }

        // --- 2. Получаем все группы преподавателя ---
        const groups = db.prepare(`
            SELECT g.id, g.name, g.created_at
            FROM Teachers_Groups tg
            JOIN Groups g ON tg.group_id = g.id
            WHERE tg.teacher_id = ?
        `).all(user.id);

        // --- 3. Для каждой группы получаем студентов ---
        const getStudents = db.prepare(`
            SELECT id, username, first_name, last_name
            FROM Users
            WHERE group_id = ?
        `);

        const result = groups.map((group: any) => ({
            id: group.id,
            name: group.name,
            created_at: group.created_at,
            students: getStudents.all(group.id)
        }));

        return NextResponse.json({ groups: result });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}