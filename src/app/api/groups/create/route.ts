import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request) {
  if (!SECRET) {
    throw new Error('no jwt');
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
    const user = db
      .prepare(
        `
            SELECT Users.username, Users.id, Roles.is_admin
            FROM Users
            LEFT JOIN Roles ON Users.role_id = Roles.id
            WHERE Users.username = ?
        `
      )
      .get(payload.username) as { id: number; is_admin: number; username: string };

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Forbidden: not admin' }, { status: 403 });
    }

    // --- 2. Парсинг данных ---
    const body = await request.json();
    const { group_name, students } = body;

    if (!group_name || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // --- 3. Проверяем, существует ли группа ---
    let groupId: number;
    let groupCreated = false;

    const existingGroup = db.prepare('SELECT id FROM Groups WHERE name = ?').get(group_name) as
      | { id: number }
      | undefined;

    if (existingGroup) {
      // Группа уже существует
      groupId = existingGroup.id;
      console.log(`Group "${group_name}" already exists with id ${groupId}`);
    } else {
      // Создаём новую группу
      const groupResult = db.prepare('INSERT INTO Groups (name) VALUES (?)').run(group_name);
      groupId = groupResult.lastInsertRowid as number;
      groupCreated = true;
      console.log(`Created new group "${group_name}" with id ${groupId}`);
    }

    // --- 4. Обработка студентов ---
    const insertUser = db.prepare(
      `INSERT INTO Users (username, password_hash, first_name, last_name, role_id, group_id, is_active)
       VALUES (?, ?, ?, ?, 1, ?, 1)`
    );

    const updateUserGroup = db.prepare(`UPDATE Users SET group_id = ? WHERE id = ?`);

    const createdStudents = [];
    const existingStudents = [];
    const updatedStudents = [];

    for (const student of students) {
      const { username, first_name, last_name } = student;

      // Проверяем, существует ли пользователь
      const existingUser = db.prepare('SELECT id, group_id FROM Users WHERE username = ?').get(username) as
        | { id: number; group_id: number | null }
        | undefined;

      if (existingUser) {
        // Пользователь существует
        if (existingUser.group_id === null || existingUser.group_id !== groupId) {
          // Обновляем группу пользователя
          updateUserGroup.run(groupId, existingUser.id);
          updatedStudents.push({
            username,
            first_name,
            last_name,
            status: 'updated',
            previous_group_id: existingUser.group_id,
            new_group_id: groupId,
          });
        } else {
          // Пользователь уже в нужной группе
          existingStudents.push({
            username,
            first_name,
            last_name,
            status: 'already_in_group',
          });
        }
      } else {
        // Создаём нового пользователя
        const password = username; // Пароль = username
        const password_hash = bcrypt.hashSync(password, 8);

        insertUser.run(username, password_hash, first_name, last_name, groupId);

        createdStudents.push({
          username,
          first_name,
          last_name,
          password, // отдаём пароль в ответе
          status: 'created',
        });
      }
    }

    // --- 5. Добавить связь teacher-группа (если ещё не создана) ---
    const existingTeacherGroup = db
      .prepare('SELECT teacher_id FROM Teachers_Groups WHERE teacher_id = ? AND group_id = ?')
      .get(user.id, groupId) as { teacher_id: number } | undefined;

    let teacherGroupCreated = false;
    if (!existingTeacherGroup) {
      db.prepare('INSERT INTO Teachers_Groups (teacher_id, group_id) VALUES (?, ?)').run(user.id, groupId);
      teacherGroupCreated = true;
    }

    return NextResponse.json({
      group_name,
      group_id: groupId,
      group_created: groupCreated,
      teacher_group_created: teacherGroupCreated,
      summary: {
        total: students.length,
        created: createdStudents.length,
        updated: updatedStudents.length,
        already_existed: existingStudents.length,
      },
      students: {
        created: createdStudents,
        updated: updatedStudents,
        existing: existingStudents,
      },
    });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
