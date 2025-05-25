import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
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
            SELECT Users.username, Users.id, Roles.is_admin
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

        // --- 2. Создание группы и студентов ---
        const body = await request.json();
        const { group_name, students } = body;

        if (!group_name || !Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // 1. Создать группу
        const groupResult = db.prepare(
            'INSERT INTO Groups (name) VALUES (?)'
        ).run(group_name);
        const groupId = groupResult.lastInsertRowid as number;

        // 2. Создать пользователей и привязать к группе
        const insertUser = db.prepare(
            `INSERT INTO Users (username, password_hash, first_name, last_name, role_id, group_id, is_active)
             VALUES (?, ?, ?, ?, 1, ?, 1)`
        );

        const createdStudents = [];

        for (const student of students) {
            const { username, first_name, last_name } = student;
            const password = username;
            const password_hash = bcrypt.hashSync(password, 8);

            insertUser.run(username, password_hash, first_name, last_name, groupId);

            createdStudents.push({
                username,
                first_name,
                last_name,
                password, // отдаём пароль в ответе
            });
        }

        // --- 3. Добавить связь teacher-группа ---
        db.prepare(
            'INSERT INTO Teachers_Groups (teacher_id, group_id) VALUES (?, ?)'
        ).run(user.id, groupId);

        return NextResponse.json({
            group_name,
            students: createdStudents,
        });
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: 'Group or user already exists' }, { status: 409 });
        }
        console.error(error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

const body = `
{
    "group_name": "ИУ1-62Б",
    "students": [
        {
            "first_name": "Александр",
            "last_name": "Батовкин",
            "username": "bae22u593"
        },
        {
            "first_name": "Алексей",
            "last_name": "Зонов",
            "username": "zas21u546"
        },
        {
            "first_name": "Тимур",
            "last_name": "Исаев",
            "username": "ita22u469"
        },
        {
            "first_name": "Татьяна",
            "last_name": "Королева",
            "username": "ktv22u926"
        },
        {
            "first_name": "Александр",
            "last_name": "Коршунов",
            "username": "kai22u927"
        }
    ]
}
`