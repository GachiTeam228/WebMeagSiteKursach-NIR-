'use client';
import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';

interface AnalyticsProps {
  studentId: number;
  studentName: string;
  disciplineId?: number;
}

interface AnalyticsData {
  risk_probability: number;
  is_at_risk: boolean;
  reasons: string[];
  competency_summary: {
    weak_areas: string[];
    strong_areas: string[];
  };
  recommended_tags_for_search: string[];
}

interface RecommendationData {
  recommendedTopics: string[];
  reasoning: string;
  peerCount: number;
  testsByTopic: Record<string, number[]>;
}

export default function StudentAnalytics({ studentId, studentName, disciplineId }: AnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [recommendationData, setRecommendationData] = useState<RecommendationData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState('');

  // Функция вызова API для получения аналитики
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    setError('');
    setRecommendationData(null); // Очищаем рекомендации при новом анализе
    try {
      const url = disciplineId
        ? `/api/student/${studentId}/analytics?disciplineId=${disciplineId}`
        : `/api/student/${studentId}/analytics`;
      const response = await fetch(url, {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ошибка при загрузке аналитики');
      setAnalyticsData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Функция вызова API для получения рекомендаций
  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    setError('');
    try {
      const response = await fetch(`/api/student/${studentId}/recommendations`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ошибка при загрузке рекомендаций');
      setRecommendationData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Преобразуем данные профиля компетенций для графика Recharts
  const formatRadarData = (profile: Record<string, number>) => {
    if (!profile) return [];
    return Object.keys(profile).map((key) => ({
      subject: key,
      A: Math.round(profile[key]),
      fullMark: 100,
    }));
  };

  return (
    <Paper
      elevation={3}
      sx={{ p: 3, mb: 3, borderRadius: 2 }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexDirection={{ xs: 'column', sm: 'row' }}
        mb={2}
        gap={2}
      >
        <Typography
          variant="h6"
          fontWeight="bold"
        >
          Аналитика успеваемости студента: {studentName}
        </Typography>
        <Box
          display="flex"
          gap={1}
          flexWrap="wrap"
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<AutoGraphIcon />}
            onClick={fetchAnalytics}
            disabled={loadingAnalytics}
          >
            {loadingAnalytics ? 'Анализ...' : 'Получить прогноз'}
          </Button>
          {analyticsData && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<TipsAndUpdatesIcon />}
              onClick={fetchRecommendations}
              disabled={loadingRecommendations}
            >
              {loadingRecommendations ? 'Загрузка...' : 'Рекомендации'}
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {(loadingAnalytics || loadingRecommendations) && (
        <Box
          display="flex"
          justifyContent="center"
          p={4}
        >
          <CircularProgress />
        </Box>
      )}

      {/* ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ АНАЛИТИКИ */}
      {analyticsData && !loadingAnalytics && (
        <Box
          display="flex"
          flexDirection={{ xs: 'column', md: 'row' }}
          gap={4}
          mt={3}
        >
          {/* Левая колонка: Прогноз и Причины */}
          <Box flex={1}>
            <Alert
              severity={analyticsData.is_at_risk ? 'error' : 'success'}
              icon={
                analyticsData.is_at_risk ? (
                  <WarningAmberIcon fontSize="large" />
                ) : (
                  <CheckCircleOutlineIcon fontSize="large" />
                )
              }
              sx={{ mb: 3, borderRadius: 2 }}
            >
              <AlertTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                {analyticsData.is_at_risk ? 'Высокий риск неуспеваемости' : 'Обучение проходит в штатном режиме'}
              </AlertTitle>
              Вероятность неуспеваемости: <strong>{(analyticsData.risk_probability * 100).toFixed(1)}%</strong>
            </Alert>

            <Typography
              variant="subtitle1"
              fontWeight="bold"
              gutterBottom
            >
              Ключевые факторы риска:
            </Typography>
            <Box
              component="ul"
              sx={{ pl: 2, mb: 3 }}
            >
              {analyticsData.reasons.length > 0 ? (
                analyticsData.reasons.map((reason: string, idx: number) => (
                  <Box
                    component="li"
                    key={idx}
                    sx={{ mb: 0.5 }}
                  >
                    {reason}
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">Значимых негативных факторов не выявлено</Typography>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Typography
              variant="subtitle1"
              fontWeight="bold"
              gutterBottom
              color="primary"
            >
              Слабые компетенции:
            </Typography>
            {analyticsData.competency_summary?.weak_areas?.length > 0 ? (
              <Box>
                <Typography
                  variant="body2"
                  mb={1}
                >
                  Рекомендуется углубить знания по:
                </Typography>
                {analyticsData.competency_summary.weak_areas.map((tag: string) => (
                  <Chip
                    key={tag}
                    label={tag}
                    color="error"
                    variant="outlined"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary">Слабых компетенций не выявлено</Typography>
            )}
          </Box>

          {/* Правая колонка: Радарная диаграмма компетенций */}
          {analyticsData.recommended_tags_for_search && (
            <Box
              flex={1}
              minHeight={300}
              display="flex"
              flexDirection="column"
              alignItems="center"
            >
              <Typography
                variant="subtitle2"
                fontWeight="bold"
                color="text.secondary"
                mb={2}
              >
                Профиль компетенций по темам
              </Typography>
              <ResponsiveContainer
                width="100%"
                height={300}
              >
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  data={formatRadarData({
                    ...analyticsData.competency_summary.weak_areas.reduce(
                      (acc, topic) => ({ ...acc, [topic]: 30 }),
                      {}
                    ),
                    ...analyticsData.competency_summary.strong_areas.reduce(
                      (acc, topic) => ({ ...acc, [topic]: 80 }),
                      {}
                    ),
                  })}
                >
                  <PolarGrid />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                  />
                  <Radar
                    name="Навыки"
                    dataKey="A"
                    stroke={analyticsData.is_at_risk ? '#d32f2f' : '#2e7d32'}
                    fill={analyticsData.is_at_risk ? '#ef5350' : '#4caf50'}
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>
      )}

      {/* ОТОБРАЖЕНИЕ РЕКОМЕНДАЦИЙ */}
      {recommendationData && !loadingRecommendations && (
        <Box mt={4}>
          <Divider sx={{ mb: 3 }} />
          <Card
            variant="outlined"
            sx={{ backgroundColor: '#f5f5f5' }}
          >
            <CardContent>
              <Typography
                variant="h6"
                fontWeight="bold"
                mb={2}
              >
                Рекомендуемые темы для углубления
              </Typography>

              <Alert
                severity="info"
                sx={{ mb: 2 }}
              >
                <AlertTitle>Рекомендация основана на анализе:</AlertTitle>
                {recommendationData.reasoning}
              </Alert>

              {recommendationData.recommendedTopics.length > 0 ? (
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    mb={2}
                  >
                    Топ-{recommendationData.recommendedTopics.length} слабых навыков:
                  </Typography>
                  {recommendationData.recommendedTopics.map((topic: string, idx: number) => {
                    const testIds = recommendationData.testsByTopic[topic] || [];
                    return (
                      <Card
                        key={topic}
                        variant="outlined"
                        sx={{ mb: 2, p: 2, backgroundColor: '#fff' }}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography
                              variant="subtitle2"
                              fontWeight="bold"
                            >
                              {idx + 1}. {topic}
                            </Typography>
                            {testIds.length > 0 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Найдено {testIds.length} тестов по этой теме
                              </Typography>
                            )}
                          </Box>
                          {testIds.length > 0 && (
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              href={`/teacher/discipline?testTags=${topic}`}
                            >
                              Перейти к тестам
                            </Button>
                          )}
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              ) : (
                <Typography color="text.secondary">
                  Слабых навыков не обнаружено. Студент хорошо справляется со всеми темами!
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Paper>
  );
}
