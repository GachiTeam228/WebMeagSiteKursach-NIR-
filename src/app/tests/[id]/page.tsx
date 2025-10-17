'use client';

import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  LinearProgress,
  Alert,
  Chip,
  CircularProgress, // Импортируем CircularProgress
} from '@mui/material';
import { ArrowBack, TimerOutlined, CheckCircle } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, useCallback, useRef } from 'react';
import Image from 'next/image';
import { style } from '@mui/system';

// --- ИНТЕРФЕЙСЫ ДЛЯ ТИПИЗАЦИИ ---
interface Option {
  id: number;
  option_text: string;
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single' | 'multiple';
  options: Option[];
  image_url?: string;
}

interface TestData {
  title: string;
  time_limit_minutes: number | null;
  questions: Question[];
}

export default function TestPage({ params }: { params: { id: string } }) {
  const { id } = use(params);
  const router = useRouter();
  const [testData, setTestData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleFinishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const startAndLoadTest = async () => {
      try {
        const startRes = await fetch(`/api/test/${id}/start`, { method: 'POST' });
        const startData = await startRes.json();

        if (!startRes.ok) throw new Error(startData.error || 'Ошибка старта попытки');
        if (startData.is_completed) {
          setIsCompleted(true);
          setLoading(false);
          return;
        }

        // --- ИЗМЕНЕНИЕ: Используем готовое значение с сервера ---
        if (typeof startData.remaining_seconds === 'number') {
          setTimeLeft(startData.remaining_seconds);
        }

        const [testRes, savedRes] = await Promise.all([fetch(`/api/test/${id}`), fetch(`/api/test/${id}/saved`)]);

        if (!testRes.ok) throw new Error('Ошибка загрузки теста');
        const testData: TestData = await testRes.json();
        setTestData(testData);

        if (savedRes.ok) {
          const savedData = await savedRes.json();
          if (savedData && savedData.answers) {
            const parsedAnswers = Object.fromEntries(
              Object.entries(savedData.answers).map(([qid, arr]) => [
                Number(qid),
                Array.isArray(arr) && arr.length === 1 ? arr[0] : arr,
              ])
            );
            setAnswers(parsedAnswers);
            const firstUnanswered = testData.questions.findIndex((q) => !(q.id in parsedAnswers));
            setActiveQuestion(firstUnanswered !== -1 ? firstUnanswered : 0);
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    startAndLoadTest();
  }, [id]);

  // --- ТАЙМЕР (остается без изменений, он теперь работает с правильными данными) ---
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) {
      if (timeLeft === 0 && !isCompleted && !isFinishing) {
        handleFinishRef.current();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isCompleted, isFinishing]);

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 5. Отправка ответа на вопрос
  const sendAnswer = useCallback(
    async (questionId: number, answer_option_id: number | number[]) => {
      // --- ИЗМЕНЕНИЕ: Эта функция больше не управляет глобальным состоянием отправки ---
      try {
        const res = await fetch(`/api/test/${id}/answer`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: questionId,
            answer_option_id,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || data.message || 'Ошибка отправки ответа');
        }
      } catch (e: any) {
        // Ошибку можно показать во всплывающем уведомлении, чтобы не блокировать UI
        console.error('Ошибка отправки промежуточного ответа:', e.message);
      }
    },
    [id]
  );

  const questions = testData?.questions || [];

  // 6. Клик "Следующий вопрос"
  const handleNext = async () => {
    // --- ИСПРАВЛЕНИЕ: Добавлена проверка на наличие вопросов ---
    if (!questions || questions.length === 0) return;

    const q = questions[activeQuestion];
    const answer = answers[q.id];
    if (answer !== undefined) {
      await sendAnswer(q.id, answer);
    }
    setActiveQuestion((prev) => prev + 1);
  };

  // 7. Клик "Завершить тест"
  const handleFinish = useCallback(async () => {
    // --- ИЗМЕНЕНИЕ: Проверяем и устанавливаем isFinishing ---
    if (isFinishing) {
      return;
    }
    setIsFinishing(true);

    if (!questions || questions.length === 0) {
      try {
        const res = await fetch(`/api/test/${id}/end`, { method: 'POST', credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка завершения теста');
        router.push(`/tests/result/${id}`);
      } catch (e: any) {
        setError(e.message);
        setIsFinishing(false);
      }
      return;
    }

    const q = questions[activeQuestion];
    if (q) {
      const answer = answers[q.id];
      if (answer !== undefined) {
        sendAnswer(q.id, answer);
      }
    }

    try {
      const res = await fetch(`/api/test/${id}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.message || 'Ошибка завершения теста');
      }
      router.push(`/tests/result/${id}`);
    } catch (e: any) {
      setError(e.message);
      setIsFinishing(false);
    }
  }, [activeQuestion, answers, id, questions, router, sendAnswer, isFinishing]);

  useEffect(() => {
    handleFinishRef.current = handleFinish;
  }, [handleFinish]);

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <CircularProgress size={50} />
        <Typography sx={{ ml: 2 }}>Загрузка теста...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container
        maxWidth="md"
        sx={{ py: 4 }}
      >
        <h1 style={{ marginBottom: '20px' }}>Произошла ошибка...</h1>
        {error === 'No token' ? (
          <Alert severity="error">
            <p>У вас нет активной сессии. Войдите в свой аккаунт.</p>
            <Button
              onClick={() => router.push('/auth/login')}
              sx={{ mt: '10px' }}
              variant="contained"
            >
              Войти
            </Button>
          </Alert>
        ) : (
          <Alert severity="error">
            <p>{error}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                onClick={() => window.location.reload()}
                sx={{ mt: '10px' }}
                variant="contained"
              >
                Перезагрузить страницу
              </Button>
              <Button
                onClick={() => router.push('/')}
                sx={{ mt: '10px' }}
                variant="contained"
              >
                Перейти на главную
              </Button>
            </div>
          </Alert>
        )}
      </Container>
    );
  }

  if (isCompleted) {
    return (
      <Container
        maxWidth="md"
        sx={{
          py: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
        }}
      >
        <Alert
          severity="info"
          sx={{ mb: 4, width: '100%', maxWidth: 480 }}
        >
          <Typography
            variant="h5"
            sx={{ mb: 2 }}
          >
            Тест уже пройден
          </Typography>
          <Typography>Вы уже завершили этот тест. Посмотрите результаты!</Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => router.push(`/tests/result/${id}`)}
        >
          Перейти к результатам
        </Button>
      </Container>
    );
  }

  const currentQuestion = questions[activeQuestion];

  // --- ИСПРАВЛЕНИЕ: Добавлена проверка на пустой тест после загрузки ---
  if (!loading && (!testData || !currentQuestion)) {
    return (
      <Container
        maxWidth="md"
        sx={{ py: 8, textAlign: 'center' }}
      >
        <Alert
          severity="warning"
          sx={{ mb: 4 }}
        >
          <Typography variant="h5">Тест пуст</Typography>
          <Typography>В этом тесте нет вопросов. Вы можете завершить его.</Typography>
        </Alert>
        <Button
          variant="contained"
          onClick={handleFinish}
          disabled={isFinishing}
        >
          {isFinishing ? <CircularProgress size={24} /> : 'Завершить пустой тест'}
        </Button>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      sx={{ py: 4 }}
    >
      <Button
        startIcon={<ArrowBack />}
        onClick={() => router.back()}
        sx={{ mb: 3 }}
      >
        Назад
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700 }}
        >
          {testData?.title}
        </Typography>
        {/* --- ОТОБРАЖАЕМ ТАЙМЕР, ТОЛЬКО ЕСЛИ ЕСТЬ ЛИМИТ ВРЕМЕНИ --- */}
        {timeLeft !== null && (
          <Chip
            icon={<TimerOutlined />}
            label={`Осталось: ${formatTime(timeLeft)}`}
            color={timeLeft < 300 ? 'error' : 'primary'}
            variant="outlined"
          />
        )}
      </Box>

      <LinearProgress
        variant="determinate"
        value={((activeQuestion + 1) / questions.length) * 100}
        sx={{ mb: 3, height: 8, borderRadius: 4 }}
      />

      <Card elevation={3}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{ mb: 3 }}
          >
            Вопрос {activeQuestion + 1} из {questions.length}
          </Typography>

          <Typography
            variant="body1"
            sx={{ mb: 4, fontWeight: 500 }}
          >
            {currentQuestion?.question_text}
          </Typography>

          {currentQuestion.image_url && (
            <Box sx={{ my: 2 }}>
              <img
                src={currentQuestion.image_url}
                alt="Вопрос"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  display: 'block',
                }}
              />
            </Box>
          )}

          {currentQuestion?.question_type === 'single' ? (
            <RadioGroup
              value={answers[currentQuestion.id] ?? ''}
              onChange={(e) => {
                setAnswers((prev) => ({
                  ...prev,
                  [currentQuestion.id]: Number(e.target.value),
                }));
              }}
            >
              {currentQuestion.options.map((option: any) => (
                <FormControlLabel
                  key={option.id}
                  value={option.id}
                  control={<Radio />}
                  label={option.option_text}
                  sx={{ mb: 1 }}
                  disabled={isFinishing}
                />
              ))}
            </RadioGroup>
          ) : (
            <Box>
              {currentQuestion.options.map((option: any) => (
                <FormControlLabel
                  key={option.id}
                  control={
                    <Checkbox
                      checked={
                        Array.isArray(answers[currentQuestion.id])
                          ? answers[currentQuestion.id].includes(option.id)
                          : false
                      }
                      onChange={(e) => {
                        const currentAnswers = Array.isArray(answers[currentQuestion.id])
                          ? answers[currentQuestion.id]
                          : [];
                        const newAnswers = e.target.checked
                          ? [...currentAnswers, option.id]
                          : currentAnswers.filter((id: number) => id !== option.id);

                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: newAnswers,
                        }));
                      }}
                      disabled={isFinishing}
                    />
                  }
                  label={option.option_text}
                  sx={{ mb: 1, display: 'flex' }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          disabled={activeQuestion === 0 || isFinishing}
          onClick={() => setActiveQuestion((prev) => prev - 1)}
        >
          Назад
        </Button>

        {activeQuestion < questions.length - 1 ? (
          <Button
            variant="contained"
            disabled={isFinishing}
            onClick={handleNext}
          >
            Следующий вопрос
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={handleFinish}
            endIcon={<CheckCircle />}
            disabled={isFinishing}
          >
            Завершить тест
          </Button>
        )}
      </Box>

      {timeLeft !== null && timeLeft < 300 && (
        <Alert
          severity="warning"
          sx={{ mt: 3 }}
        >
          Внимание! Осталось мало времени. Рекомендуем завершить тест.
        </Alert>
      )}
    </Container>
  );
}
