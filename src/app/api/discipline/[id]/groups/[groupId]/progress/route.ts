// app/api/discipline/[id]/group/[groupId]/progress/route.ts

import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET(request: Request, { params }: { params: { id: string; groupId: string } }) {
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

    // Только преподаватели
    if (user.role_id !== 2) {
      return NextResponse.json({ error: 'Only teachers can view group progress' }, { status: 403 });
    }

    const id = Number((await params).id);
    const groupId = Number((await params).groupId);

    // Проверяем, что это дисциплина преподавателя
    const subject = db.prepare('SELECT id, name FROM Subjects WHERE id = ? AND teacher_id = ?').get(id, user.id) as
      | { id: number; name: string }
      | undefined;

    if (!subject) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Получаем информацию о группе
    const group = db.prepare('SELECT id, name FROM Groups WHERE id = ?').get(groupId) as
      | { id: number; name: string }
      | undefined;

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Получаем всех студентов группы
    const students = db
      .prepare(
        `SELECT id, first_name, last_name, username
         FROM Users
         WHERE group_id = ? AND role_id = 1 AND is_active = 1
         ORDER BY last_name, first_name`
      )
      .all(groupId) as { id: number; first_name: string; last_name: string; username: string }[];

    // Получаем все тесты дисциплины с главами
    const tests = db
      .prepare(
        `SELECT 
          t.id,
          t.title,
          c.name as chapter_name,
          (SELECT COALESCE(SUM(points), 0) FROM Questions WHERE test_id = t.id) as max_score
         FROM Tests t
         JOIN Chapters c ON t.chapter_id = c.id
         WHERE t.subject_id = ?
         ORDER BY c.order_number, t.order_number`
      )
      .all(id) as {
      id: number;
      title: string;
      chapter_name: string;
      max_score: number;
    }[];

    // Получаем результаты всех студентов
    const studentsProgress = students.map((student) => {
      const testResults = tests.map((test) => {
        // Проверяем, назначен ли тест студенту
        const assignment = db
          .prepare(
            `SELECT id, is_completed, deadline
             FROM TestAssignments
             WHERE test_id = ? AND user_id = ?`
          )
          .get(test.id, student.id) as { id: number; is_completed: number; deadline: string | null } | undefined;

        if (!assignment) {
          return {
            testId: test.id,
            testName: test.title,
            maxScore: test.max_score,
            score: null,
            status: 'not-assigned' as const,
            completedAt: null,
          };
        }

        // Получаем лучший результат студента
        const bestAttempt = db
          .prepare(
            `SELECT score, end_time
             FROM Attempts
             WHERE user_id = ? AND test_id = ? AND is_completed = 1
             ORDER BY score DESC
             LIMIT 1`
          )
          .get(student.id, test.id) as { score: number; end_time: string } | undefined;

        let status: 'completed' | 'in-progress' | 'overdue' | 'not-started';

        if (bestAttempt) {
          status = 'completed';
        } else {
          const now = new Date();
          const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
          if (deadline && now > deadline) {
            status = 'overdue';
          } else {
            // Проверяем, есть ли активная попытка
            const hasActiveAttempt = db
              .prepare(
                `SELECT COUNT(*) as count
                 FROM Attempts
                 WHERE user_id = ? AND test_id = ? AND is_completed = 0`
              )
              .get(student.id, test.id) as { count: number };

            status = hasActiveAttempt.count > 0 ? 'in-progress' : 'not-started';
          }
        }

        return {
          testId: test.id,
          testName: test.title,
          maxScore: test.max_score,
          score: bestAttempt?.score || null,
          status,
          completedAt: bestAttempt?.end_time || null,
        };
      });

      // Подсчитываем общий балл студента (только по назначенным тестам)
      const totalScore = testResults.reduce((sum, result) => {
        if (result.status !== 'not-assigned' && result.score !== null) {
          return sum + result.score;
        }
        return sum;
      }, 0);

      const maxTotalScore = testResults.reduce((sum, result) => {
        if (result.status !== 'not-assigned') {
          return sum + result.maxScore;
        }
        return sum;
      }, 0);

      return {
        studentId: student.id,
        studentName: `${student.last_name} ${student.first_name}`,
        email: student.username,
        testResults,
        totalScore,
        maxTotalScore,
      };
    });

    // Группируем тесты по главам для заголовков
    const chaptersMap = new Map<string, { name: string; tests: any[] }>();
    tests.forEach((test) => {
      if (!chaptersMap.has(test.chapter_name)) {
        chaptersMap.set(test.chapter_name, {
          name: test.chapter_name,
          tests: [],
        });
      }
      chaptersMap.get(test.chapter_name)!.tests.push({
        id: test.id,
        title: test.title,
        maxScore: test.max_score,
      });
    });

    const chapters = Array.from(chaptersMap.values());

    return NextResponse.json({
      discipline: {
        id: subject.id,
        name: subject.name,
      },
      group: {
        id: group.id,
        name: group.name,
      },
      chapters,
      students: studentsProgress,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
