import { NextResponse } from 'next/server';
import { db } from '@lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SECRET) {
    return NextResponse.json({ error: 'JWT_SECRET is not set' }, { status: 500 });
  }

  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload: any = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id, role_id FROM Users WHERE id = ?').get(payload.id) as {
      id: number;
      role_id: number;
    };

    if (!user || user.role_id !== 1) {
      // Только студенты
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const testId = Number((await params).id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: 'Invalid test ID' }, { status: 400 });
    }

    // Ищем НЕЗАВЕРШЁННЫЙ assignment (is_completed = 0)
    const testAssignment = db
      .prepare(
        `SELECT id, deadline, is_completed 
         FROM TestAssignments 
         WHERE test_id = ? AND user_id = ? AND is_completed = 0
         ORDER BY deadline ASC
         LIMIT 1`
      )
      .get(testId, user.id) as { id: number; deadline: string | null; is_completed: number } | undefined;

    // Если незавершённого assignment нет, проверяем, был ли он вообще назначен
    if (!testAssignment) {
      // Проверяем, есть ли хотя бы один assignment (завершённый или нет)
      const anyAssignment = db
        .prepare('SELECT COUNT(*) as count FROM TestAssignments WHERE test_id = ? AND user_id = ?')
        .get(testId, user.id) as { count: number };

      if (anyAssignment.count === 0) {
        return NextResponse.json(
          {
            error: 'Test is not assigned to you',
            assigned: false,
          },
          { status: 403 }
        );
      } else {
        // Тест был назначен, но все assignments завершены
        return NextResponse.json(
          {
            error: 'All test assignments are completed',
            assigned: true,
            assignment_completed: true,
          },
          { status: 403 }
        );
      }
    }

    // Проверяем дедлайн (если установлен)
    if (testAssignment.deadline) {
      const deadlineDate = new Date(testAssignment.deadline);
      const now = new Date();
      if (now > deadlineDate) {
        return NextResponse.json(
          {
            error: 'Test deadline has passed',
            assigned: true,
            deadline_passed: true,
            deadline: testAssignment.deadline,
          },
          { status: 403 }
        );
      }
    }

    const test = db.prepare('SELECT time_limit_minutes FROM Tests WHERE id = ?').get(testId) as {
      time_limit_minutes: number | null;
    };

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Проверяем, есть ли незавершённая попытка
    const activeAttempt = db
      .prepare(
        'SELECT id, start_time, is_completed FROM Attempts WHERE user_id = ? AND test_id = ? AND is_completed = 0 ORDER BY start_time DESC LIMIT 1'
      )
      .get(user.id, testId) as { id: number; start_time: string; is_completed: number } | undefined;

    // Функция для вычисления оставшихся секунд на сервере
    const calculateRemainingSeconds = (startTime: string, durationMinutes: number | null): number | null => {
      if (durationMinutes === null || durationMinutes <= 0) {
        return null; // Нет лимита времени
      }
      const diff = db
        .prepare("SELECT strftime('%s', 'now', 'localtime') - strftime('%s', ?) as seconds")
        .get(startTime) as { seconds: number };
      const remaining = durationMinutes * 60 - diff.seconds;
      return remaining > 0 ? remaining : 0;
    };

    if (activeAttempt) {
      // Есть незавершённая попытка - возвращаем её
      const remaining_seconds = calculateRemainingSeconds(activeAttempt.start_time, test.time_limit_minutes);
      return NextResponse.json({
        attempt_id: activeAttempt.id,
        start_time: activeAttempt.start_time,
        is_completed: false,
        assigned: true,
        message: 'Active attempt found',
        remaining_seconds,
      });
    } else {
      // Нет незавершённой попытки - создаём новую
      const result = db
        .prepare("INSERT INTO Attempts (user_id, test_id, start_time) VALUES (?, ?, datetime('now', 'localtime'))")
        .run(user.id, testId);
      const newAttemptId = result.lastInsertRowid;
      const newAttempt = db.prepare('SELECT id, start_time FROM Attempts WHERE id = ?').get(newAttemptId) as {
        id: number;
        start_time: string;
      };

      const remaining_seconds = test.time_limit_minutes ? test.time_limit_minutes * 60 : null;

      return NextResponse.json({
        attempt_id: newAttempt.id,
        start_time: newAttempt.start_time,
        assigned: true,
        is_completed: false,
        message: 'New attempt started',
        remaining_seconds,
      });
    }
  } catch (error) {
    console.error('Error starting test:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
