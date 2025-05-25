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
} from '@mui/material';
import {
    ArrowBack,
    TimerOutlined,
    CheckCircle,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, useCallback, useRef } from 'react';

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [testData, setTestData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(1800);
    const [answers, setAnswers] = useState<Record<number, any>>({});
    const [activeQuestion, setActiveQuestion] = useState(0);
    const [attemptId, setAttemptId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [startTime, setStartTime] = useState<string | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);

    // Ключ для localStorage
    const localStorageKey = `test_answers_${id}`;

    // 1. Получаем startTime и testData
    useEffect(() => {
        let ignore = false;
        setLoading(true);

        fetch(`/api/test/${id}/start`, {
            method: 'POST',
            credentials: 'include',
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || data.message || 'Ошибка старта попытки');
                }
                return res.json();
            })
            .then((data) => {
                if (!ignore) {
                    setAttemptId(data.attempt_id);
                    setStartTime(data.start_time);
                    setIsCompleted(!!data.is_completed);

                    // Если попытка завершена — очищаем localStorage
                    if (data.is_completed) {
                        localStorage.removeItem(localStorageKey);
                    } else if (data.message === 'Attempt already exists') {
                        // Восстанавливаем ответы
                        const saved = localStorage.getItem(localStorageKey);
                        if (saved) {
                            try {
                                setAnswers(JSON.parse(saved));
                            } catch {}
                        }
                    }
                    // Не очищайте localStorage в else!
                }
            })
            .then(() =>
                fetch(`/api/test/${id}`)
                    .then(async (res) => {
                        if (!res.ok) throw new Error('Ошибка загрузки теста');
                        return res.json();
                    })
                    .then((data) => {
                        if (!ignore) {
                            setTestData(data.chapter.test);
                            setLoading(false);
                        }
                    })
            )
            .catch((e) => {
                if (!ignore) {
                    setError(e.message);
                    setLoading(false);
                }
            });
        return () => {
            ignore = true;
        };
    }, [id]);

    // 2. Синхронизируем таймер, когда оба значения получены
    useEffect(() => {
        if (startTime && testData?.time_limit_minutes) {
            const seconds = getSecondsDiff(startTime, testData.time_limit_minutes);
            setTimeLeft(seconds > 0 ? seconds : 0);
        }
    }, [startTime, testData]);

    function getSecondsDiff(start: string, durationMinutes: number) {
        if (!start || !durationMinutes) return 0;
        const iso = start.replace(' ', 'T') + 'Z';
        const startDate = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now.getTime() - startDate.getTime()) / 1000);
        return durationMinutes * 60 - diff;
    }

    // 3. Таймер
    useEffect(() => {
        if (timeLeft <= 0) {
            if (!isCompleted && !submitting) {
                handleFinishRef.current();
            }
            return;
        }
        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, isCompleted, submitting]);

    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // 4. Сохраняем ответы в localStorage при каждом изменении
    useEffect(() => {
        localStorage.setItem(localStorageKey, JSON.stringify(answers));
    }, [answers, localStorageKey]);

    // 5. Отправка ответа на вопрос
    const sendAnswer = async (questionId: number, answer_option_id: number) => {
        setSubmitting(true);
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
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const questions = testData?.questions || [];

    // 6. Клик "Следующий вопрос"
    const handleNext = async () => {
        const q = questions[activeQuestion];
        const answer = answers[q.question_id];
        if (answer !== undefined) {
            await sendAnswer(q.question_id, answer);
        }
        setActiveQuestion((prev) => prev + 1);
    };

    // 7. Клик "Завершить тест"
    const handleFinish = useCallback(async () => {
        const q = questions[activeQuestion];
        const answer = answers[q.question_id];
        if (answer !== undefined) {
            await sendAnswer(q.question_id, answer);
        }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/test/${id}/end`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || data.message || 'Ошибка завершения теста');
            }
            // Очищаем localStorage после завершения теста
            localStorage.removeItem(localStorageKey);
            router.push(`/tests/result/${id}`);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    }, [activeQuestion, answers, id, questions, router, sendAnswer, localStorageKey]);

    const handleFinishRef = useRef(handleFinish);
    useEffect(() => {
        handleFinishRef.current = handleFinish;
    }, [handleFinish]);

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Typography>Загрузка...</Typography>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
   }

    // --- Новый блок: если тест завершён, показываем сообщение и кнопку ---
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
                <Alert severity="info" sx={{ mb: 4, width: '100%', maxWidth: 480 }}>
                    <Typography variant="h5" sx={{ mb: 2 }}>
                        Тест уже пройден
                    </Typography>
                    <Typography>
                        Вы уже завершили этот тест. Посмотрите результаты!
                    </Typography>
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

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Button
                startIcon={<ArrowBack />}
                onClick={() => router.back()}
                sx={{ mb: 3 }}
            >
                Назад
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {testData.test_title || testData.title}
                </Typography>
                <Chip
                    icon={<TimerOutlined />}
                    label={`Осталось: ${formatTime(timeLeft)}`}
                    color={timeLeft < 300 ? 'error' : 'primary'}
                    variant="outlined"
                />
            </Box>

            <Typography color="text.secondary" sx={{ mb: 4 }}>
                {testData.description || ''}
            </Typography>

            <LinearProgress
                variant="determinate"
                value={((activeQuestion + 1) / questions.length) * 100}
                sx={{ mb: 3, height: 8, borderRadius: 4 }}
            />

            <Card elevation={3}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                        Вопрос {activeQuestion + 1} из {questions.length}
                    </Typography>

                    <Typography variant="body1" sx={{ mb: 4, fontWeight: 500 }}>
                        {questions[activeQuestion]?.question_text}
                    </Typography>

                    {questions[activeQuestion]?.question_type === 'single' ? (
                        <RadioGroup
                            value={answers[questions[activeQuestion].question_id] ?? ''}
                            onChange={(e) => {
                                setAnswers((prev) => ({
                                    ...prev,
                                    [questions[activeQuestion].question_id]: Number(e.target.value),
                                }));
                            }}
                        >
                            {questions[activeQuestion].options.map(
                                (option: any) => (
                                    <FormControlLabel
                                        key={option.answer_option_id}
                                        value={option.answer_option_id}
                                        control={<Radio />}
                                        label={option.option_text}
                                        sx={{ mb: 1 }}
                                        disabled={submitting}
                                    />
                                )
                            )}
                        </RadioGroup>
                    ) : (
                        <Box>
                            {questions[activeQuestion].options.map(
                                (option: any) => (
                                    <FormControlLabel
                                        key={option.answer_option_id}
                                        control={
                                            <Checkbox
                                                checked={
                                                    Array.isArray(answers[questions[activeQuestion].question_id])
                                                        ? answers[questions[activeQuestion].question_id].includes(option.answer_option_id)
                                                        : false
                                                }
                                                onChange={(e) => {
                                                    const currentAnswers =
                                                        Array.isArray(answers[questions[activeQuestion].question_id])
                                                            ? answers[questions[activeQuestion].question_id]
                                                            : [];
                                                    const newAnswers = e.target.checked
                                                        ? [...currentAnswers, option.answer_option_id]
                                                        : currentAnswers.filter((id: number) => id !== option.answer_option_id);

                                                    setAnswers((prev) => ({
                                                        ...prev,
                                                        [questions[activeQuestion].question_id]: newAnswers,
                                                    }));
                                                }}
                                                disabled={submitting}
                                            />
                                        }
                                        label={option.option_text}
                                        sx={{ mb: 1, display: 'flex' }}
                                    />
                                )
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button
                    variant="outlined"
                    disabled={activeQuestion === 0 || submitting}
                    onClick={() => setActiveQuestion((prev) => prev - 1)}
                >
                    Назад
                </Button>

                {activeQuestion < questions.length - 1 ? (
                    <Button
                        variant="contained"
                        disabled={submitting}
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
                        disabled={submitting}
                    >
                        Завершить тест
                    </Button>
                )}
            </Box>

            {timeLeft < 300 && (
                <Alert severity="warning" sx={{ mt: 3 }}>
                    Внимание! Осталось мало времени. Рекомендуем завершить тест.
                </Alert>
            )}
        </Container>
    );
}