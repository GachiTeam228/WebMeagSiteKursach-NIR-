// app/api/discipline/[id]/progress/route.ts

import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      .prepare('SELECT id, role_id, first_name, last_name FROM Users WHERE username = ? AND is_active = 1')
      .get(payload.username) as { id: number; role_id: number; first_name: string; last_name: string };

    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    if (user.role_id !== 1) {
      return NextResponse.json({ error: 'Only students can view progress' }, { status: 403 });
    }

    const subjectId = (await params).id;

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

    // Получаем ВСЕ тесты включая не назначенные
    const testsResults = db
      .prepare(
        `SELECT 
          t.id,
          t.title as name,
          t.chapter_id,
          c.name as chapter_name,
          MIN(ta.deadline) as deadline,
          MAX(ta.is_completed) as assignment_completed,
          (SELECT COALESCE(SUM(points), 0) FROM Questions WHERE test_id = t.id) as max_score,
          (SELECT score FROM Attempts WHERE user_id = ? AND test_id = t.id AND is_completed = 1 ORDER BY score DESC LIMIT 1) as best_score,
          (SELECT end_time FROM Attempts WHERE user_id = ? AND test_id = t.id AND is_completed = 1 ORDER BY score DESC LIMIT 1) as completion_date,
          COUNT(ta.id) as assignment_count
        FROM Tests t
        JOIN Chapters c ON t.chapter_id = c.id
        LEFT JOIN TestAssignments ta ON t.id = ta.test_id AND ta.user_id = ?
        WHERE t.subject_id = ?
        GROUP BY t.id, t.title, t.chapter_id, c.name
        ORDER BY c.order_number, t.order_number`
      )
      .all(user.id, user.id, user.id, subjectId) as {
      id: number;
      name: string;
      chapter_id: number;
      chapter_name: string;
      deadline: string | null;
      assignment_completed: number | null;
      max_score: number;
      best_score: number | null;
      completion_date: string | null;
      assignment_count: number;
    }[];

    const moduleMap = new Map<string, any>();

    for (const test of testsResults) {
      const moduleName = test.chapter_name;

      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, {
          name: moduleName,
          items: [],
          totalScore: 0,
          maxTotalScore: 0,
        });
      }

      const modules = moduleMap.get(moduleName);

      let status: 'completed' | 'in-progress' | 'missed';

      // Если тест не назначен
      if (test.assignment_count === 0) {
        status = 'missed'; // Показываем как пропущенный

        modules.items.push({
          id: test.id,
          name: test.name,
          type: 'test',
          score: 0,
          maxScore: test.max_score,
          date: '',
          status,
        });

        // НЕ добавляем в общий балл не назначенные тесты
        modules.maxTotalScore += test.max_score;
        continue;
      }

      const now = new Date();
      const deadline = test.deadline ? new Date(test.deadline) : null;

      if (test.assignment_completed === 1 || test.best_score !== null) {
        status = 'completed';
      } else if (deadline && now > deadline) {
        status = 'missed';
      } else {
        status = 'in-progress';
      }

      modules.items.push({
        id: test.id,
        name: test.name,
        type: 'test',
        score: test.best_score || 0,
        maxScore: test.max_score,
        date: test.completion_date || '',
        status,
      });

      // Обновляем общий балл модуля только для назначенных тестов
      modules.totalScore += test.best_score || 0;
      modules.maxTotalScore += test.max_score;
    }

    const modules = Array.from(moduleMap.values());

    const totalScore = modules.reduce((sum, modules) => sum + modules.totalScore, 0);
    const maxTotalScore = modules.reduce((sum, modules) => sum + modules.maxTotalScore, 0);

    const progress = {
      studentId: user.id,
      studentName: `${user.last_name} ${user.first_name}`,
      disciplineId: Number(subjectId),
      modules,
      totalScore,
      maxTotalScore,
    };

    return NextResponse.json(progress);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
