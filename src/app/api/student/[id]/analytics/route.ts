import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@lib/db';
import {
  getStudentCompetencyProfile,
  getStudentAverageScore,
  getStudentActivityMetrics,
  saveStudentRiskAnalytics,
  getStudentRiskAnalytics,
} from '@lib/db';

const SECRET = process.env.JWT_SECRET;
const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';
const CACHE_TTL_MINUTES = 30;

// Обработчик POST-запроса (чтобы пересчитать аналитику)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const tokena = cookieStore.get('token');

    if (!tokena) {
      return NextResponse.json({ message: 'Нет токена' }, { status: 401 });
    }

    const token = tokena.value;
    const decoded = jwt.verify(token, SECRET) as { username: string }

    // Получаем пользователя
    const user = db.prepare(`
      SELECT id, username, first_name, last_name, role_id, group_id 
      FROM Users WHERE username = ?
    `).get(decoded.username) as {id: number, username: string, first_name: string, last_name: string, role_id: number, group_id: number}

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }
    
    const { id } = await params;
    const studentId = parseInt(id);

    if (isNaN(studentId)) {
      return NextResponse.json({ error: 'Неверный ID студента' }, { status: 400 });
    }

    // Получаем disciplineId из query параметров (если указан)
    const { searchParams } = new URL(request.url);
    const disciplineIdStr = searchParams.get('disciplineId');
    const disciplineId = disciplineIdStr ? parseInt(disciplineIdStr) : undefined;

    // --- 1. СБОР ДАННЫХ ИЗ БАЗЫ (АГРЕГАЦИЯ) ---
    
    // Используем новые функции из lib/db.ts
    const [competencyProfile, avgScore, totalClicks] = await Promise.all([
      getStudentCompetencyProfile(studentId, disciplineId),
      getStudentAverageScore(studentId, disciplineId),
      getStudentActivityMetrics(studentId),
    ]);

    const mlPayload = {
      avg_test_score: avgScore,
      total_clicks: totalClicks,
      competency_profile: competencyProfile
    };

    console.log(`[Analytics] Calling ML API for student ${studentId}:`, mlPayload);

    const mlResponse = await fetch(`${ML_API_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      console.error(`ML API error: ${mlResponse.status}`, errorText);
      return NextResponse.json(
        { error: `ML API error: ${mlResponse.status}` },
        { status: mlResponse.status }
      );
    }

    const mlData = await mlResponse.json();

    // --- 3. КЭШИРОВАНИЕ РЕЗУЛЬТАТА В БД ---
    const weakTags = mlData.competency_summary?.weak_areas || [];
    const reasons = mlData.reasons || [];
    
    await saveStudentRiskAnalytics(
      studentId,
      mlData.risk_probability,
      mlData.is_at_risk,
      weakTags,
      reasons
    );

    // --- 4. ВОЗВРАТ РЕЗУЛЬТАТА НА ФРОНТЕНД ---
    return NextResponse.json({
      success: true,
      message: 'Аналитика успешно обновлена',
      data: mlData,
      metrics: {
        avgScore,
        totalClicks,
        competencyProfile,
      }
    });

  } catch (error) {
    console.error('Analytics Route Error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера при анализе данных' }, 
      { status: 500 }
    );
  }
}

/**
 * GET /api/student/[id]/analytics
 * 
 * Get cached student analytics (if available)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const tokena = cookieStore.get('token');

    if (!tokena) {
      return NextResponse.json({ message: 'Нет токена' }, { status: 401 });
    }

    const token = tokena.value;
    const decoded = jwt.verify(token, SECRET) as { username: string }

    // Проверяем, что пользователь существует
    const user = db.prepare(`
      SELECT id, username, first_name, last_name, role_id, group_id 
      FROM Users WHERE username = ?
    `).get(decoded.username) as {id: number, username: string, first_name: string, last_name: string, role_id: number, group_id: number}

    if (!user) {
      return NextResponse.json({ message: 'Пользователь не найден' }, { status: 404 })
    }
    
    const { id } = await params;
    const studentId = parseInt(id);

    if (isNaN(studentId)) {
      return NextResponse.json({ error: 'Неверный ID студента' }, { status: 400 });
    }

    // Get cached analytics
    const cachedAnalytics = await getStudentRiskAnalytics(studentId);
    
    if (!cachedAnalytics) {
      return NextResponse.json(
        { error: 'Нет кэшированных результатов. Сначала вызовите POST для пересчёта.' },
        { status: 404 }
      );
    }

    // Check if cache is stale (older than TTL)
    const now = new Date();
    const lastAnalyzed = new Date(cachedAnalytics.lastAnalyzed);
    const isStale = now.getTime() - lastAnalyzed.getTime() > CACHE_TTL_MINUTES * 60 * 1000;

    return NextResponse.json({
      success: true,
      data: cachedAnalytics,
      isStale,
      message: isStale ? 'Кэш устарел, рекомендуется пересчет' : 'Свежий кэш'
    });

  } catch (error) {
    console.error('Analytics GET Error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' }, 
      { status: 500 }
    );
  }
}