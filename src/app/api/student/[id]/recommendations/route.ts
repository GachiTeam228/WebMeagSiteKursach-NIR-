/**
 * POST /api/student/[id]/recommendations
 * 
 * Get topic recommendations for a student using KNN peer similarity
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { db } from '@lib/db';
import {
  getStudentCompetencyProfile,
  getStudentAverageScore,
  getStudentActivityMetrics,
} from '@lib/db';

const SECRET = process.env.JWT_SECRET;
const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

interface RecommendationResponse {
  recommended_topics: string[];
  reasoning: string;
  peer_count: number;
  weak_topics_full: Array<[string, number]>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token_cookie = cookieStore.get('token');

    if (!token_cookie) {
      return NextResponse.json({ message: 'Нет токена' }, { status: 401 });
    }

    const token = token_cookie.value;
    const decoded = jwt.verify(token, SECRET) as { username: string };

    // Проверяем, что пользователь существует
    const user = db
      .prepare(
        `
      SELECT id, username, first_name, last_name, role_id, group_id 
      FROM Users WHERE username = ?
    `
      )
      .get(decoded.username) as {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
      role_id: number;
      group_id: number;
    };

    if (!user) {
      return NextResponse.json(
        { message: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    const { id } = await params;
    const studentId = parseInt(id);

    if (isNaN(studentId)) {
      return NextResponse.json(
        { error: 'Неверный ID студента' },
        { status: 400 }
      );
    }

    // Собираем метрики студента
    const [competencyProfile, avgScore, totalClicks] = await Promise.all([
      getStudentCompetencyProfile(studentId),
      getStudentAverageScore(studentId),
      getStudentActivityMetrics(studentId),
    ]);

    // Формируем payload для ML API
    const mlPayload = {
      avg_test_score: avgScore,
      total_clicks: totalClicks,
      competency_profile: competencyProfile,
    };

    console.log(
      `[Recommendations] Calling ML API for student ${studentId}:`,
      mlPayload
    );

    // Вызываем ML API
    const mlResponse = await fetch(`${ML_API_URL}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload),
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      console.error(`ML API error: ${mlResponse.status}`, errorText);
      return NextResponse.json(
        { error: `ML API error: ${mlResponse.status}` },
        { status: mlResponse.status }
      );
    }

    const mlData = (await mlResponse.json()) as RecommendationResponse;

    // Для каждой рекомендованной темы находим связанные тесты
    const testsByTopic = await getTestsByTopics(mlData.recommended_topics);

    return NextResponse.json({
      success: true,
      message: 'Рекомендации успешно получены',
      data: {
        recommendedTopics: mlData.recommended_topics,
        reasoning: mlData.reasoning,
        peerCount: mlData.peer_count,
        weakTopicsFull: mlData.weak_topics_full,
        testsByTopic,
      },
    });
  } catch (error) {
    console.error('Recommendations Route Error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера при получении рекомендаций' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get tests associated with given topic tags
 */
async function getTestsByTopics(
  topics: string[]
): Promise<Record<string, number[]>> {
  try {
    const result: Record<string, number[]> = {};

    for (const topic of topics) {
      const tests = db
        .prepare(
          `
        SELECT DISTINCT t.id
        FROM Tests t
        JOIN Questions q ON t.id = q.test_id
        JOIN Question_Tags qt ON q.id = qt.question_id
        JOIN Tags tg ON qt.tag_id = tg.id
        WHERE tg.name = ?
        LIMIT 5
      `
        )
        .all(topic) as Array<{ id: number }>;

      result[topic] = tests.map((row) => row.id);
    }

    return result;
  } catch (error) {
    console.error('Error fetching tests by topics:', error);
    return {};
  }
}
