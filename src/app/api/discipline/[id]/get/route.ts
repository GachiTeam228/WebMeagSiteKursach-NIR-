// app/api/discipline/[id]/get/route.ts

import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET(request: Request, { params }: { params: { id: string } }) {
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

    const user = db
      .prepare('SELECT id, role_id FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    const subjectId = (await params).id;

    // Получаем информацию о дисциплине
    const subject = db.prepare('SELECT id, name, teacher_id FROM Subjects WHERE id = ?').get(subjectId) as
      | { id: number; name: string; teacher_id: number }
      | undefined;

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Если преподаватель (role_id === 2), проверяем что это его дисциплина
    if (user.role_id === 2 && subject.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Если студент (role_id === 1), проверяем что его группа привязана к этой дисциплине
    if (user.role_id === 1) {
      const studentGroup = db.prepare('SELECT group_id FROM Users WHERE id = ?').get(user.id) as {
        group_id: number | null;
      };

      if (!studentGroup?.group_id) {
        return NextResponse.json({ error: 'Student has no group' }, { status: 403 });
      }

      const hasAccess = db
        .prepare('SELECT 1 FROM Group_Subjects WHERE group_id = ? AND subject_id = ?')
        .get(studentGroup.group_id, subjectId);

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Получаем все chapters для данной дисциплины
    const chaptersRaw = db
      .prepare(
        `SELECT id, name, order_number
       FROM Chapters
       WHERE subject_id = ?
       ORDER BY order_number`
      )
      .all(subjectId) as { id: number; name: string; order_number: number }[];

    // Получаем все тесты для данной дисциплины
    let testsRaw: any[];

    if (user.role_id === 2) {
      // Преподаватель видит все тесты
      testsRaw = db
        .prepare(
          `SELECT id, title, chapter_id, order_number
         FROM Tests
         WHERE subject_id = ?
         ORDER BY order_number`
        )
        .all(subjectId) as { id: number; title: string; chapter_id: number | null; order_number: number }[];
    } else {
      // Студент видит все тесты с информацией о статусе
      testsRaw = db
        .prepare(
          `SELECT 
            t.id, 
            t.title, 
            t.chapter_id,
            t.order_number,
            MIN(ta.deadline) as deadline,
            MAX(ta.is_completed) as assignment_completed,
            (SELECT score FROM Attempts WHERE user_id = ? AND test_id = t.id AND is_completed = 1 ORDER BY score DESC LIMIT 1) as best_score,
            (SELECT COALESCE(SUM(points), 0) FROM Questions WHERE test_id = t.id) as max_score,
            (SELECT COUNT(*) FROM Attempts WHERE user_id = ? AND test_id = t.id AND is_completed = 0) as has_active_attempt,
            COUNT(ta.id) as assignment_count
         FROM Tests t
         LEFT JOIN TestAssignments ta ON t.id = ta.test_id AND ta.user_id = ?
         WHERE t.subject_id = ?
         GROUP BY t.id, t.title, t.chapter_id, t.order_number
         ORDER BY t.order_number`
        )
        .all(user.id, user.id, user.id, subjectId) as {
        id: number;
        title: string;
        chapter_id: number | null;
        order_number: number;
        deadline: string | null;
        assignment_completed: number | null;
        best_score: number | null;
        max_score: number;
        has_active_attempt: number;
        assignment_count: number;
      }[];
    }

    // Формируем структуру chapters с вложенными tests
    const chapters = chaptersRaw.map((chapter) => ({
      id: chapter.id,
      title: chapter.name,
      order_number: chapter.order_number,
      tests: testsRaw
        .filter((test) => test.chapter_id === chapter.id)
        .map((test) => {
          if (user.role_id === 2) {
            // Для преподавателя - простая структура
            return {
              id: test.id,
              name: test.title,
              order_number: test.order_number,
            };
          } else {
            // Для студента - расширенная информация
            // Если тест не назначен (assignment_count = 0)
            if (test.assignment_count === 0) {
              return {
                id: test.id,
                name: test.title,
                order_number: test.order_number,
                status: 'not-assigned' as const,
                maxScore: test.max_score,
              };
            }

            const now = new Date();
            const deadline = test.deadline ? new Date(test.deadline) : null;
            const isOverdue = deadline && now > deadline;

            let status: 'not-assigned' | 'completed' | 'in-progress' | 'overdue';

            if (test.assignment_completed === 1) {
              status = 'completed';
            } else if (isOverdue) {
              status = 'overdue';
            } else if (test.has_active_attempt > 0) {
              status = 'in-progress';
            } else {
              status = 'not-assigned';
            }

            return {
              id: test.id,
              name: test.title,
              order_number: test.order_number,
              status,
              score: test.best_score || undefined,
              maxScore: test.max_score,
              due: test.deadline || undefined,
              completedAt: test.assignment_completed === 1 ? test.deadline : undefined,
            };
          }
        }),
    }));

    // Получаем группы только для преподавателя
    let groups: any[] = [];

    if (user.role_id === 2) {
      const groupsRaw = db
        .prepare(
          `SELECT g.id, g.name
         FROM Groups g
         JOIN Group_Subjects gs ON g.id = gs.group_id
         WHERE gs.subject_id = ?
         ORDER BY g.name`
        )
        .all(subjectId) as { id: number; name: string }[];

      groups = groupsRaw.map((group) => {
        const students = db
          .prepare(
            `SELECT id, first_name, last_name, username
           FROM Users
           WHERE group_id = ? AND role_id = 1 AND is_active = 1
           ORDER BY last_name, first_name`
          )
          .all(group.id) as { id: number; first_name: string; last_name: string; username: string }[];

        return {
          id: group.id,
          name: group.name,
          students: students.map((student) => ({
            id: student.id,
            name: `${student.last_name} ${student.first_name}`,
            email: student.username || '',
          })),
        };
      });
    }

    // Формируем итоговый ответ в формате DisciplineType
    const discipline = {
      id: subject.id,
      name: subject.name,
      description: '',
      groups,
      chapters,
    };

    return NextResponse.json(discipline);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
