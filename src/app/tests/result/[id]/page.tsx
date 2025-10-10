'use client';

import { Container, Card, CardContent, Typography, Box, LinearProgress, Button, CircularProgress, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';

export default function TestResultPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);

    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/test/${id}/result`, { credentials: 'include' })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || data.message || 'Ошибка получения результата');
                }
                return res.json();
            })
            .then(setResult)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (error || !result) {
        return (
            <Container maxWidth="md" sx={{ py: 6 }}>
                <Alert severity="error">{error || 'Ошибка загрузки результата'}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Card elevation={3} sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h4" sx={{ mb: 2 }}>
                        Результаты теста: {result.testTitle}
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">
                            Баллы: {result.score} / {result.maxScore}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={(result.score / result.maxScore) * 100}
                            sx={{ height: 10, borderRadius: 5, mt: 1 }}
                            color={result.passed ? 'success' : 'error'}
                        />
                        <Typography sx={{ mt: 2 }}>
                            {result.passed ? 'Тест пройден!' : 'Тест не пройден'}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>

            <Typography variant="h5" sx={{ mb: 2 }}>
                Вопросы:
            </Typography>
            {result.questions.map((q: any, idx: number) => (
                <Card key={idx} sx={{ mb: 2 }}>
                    <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            {idx + 1}. {q.question_text}
                        </Typography>
                        <Typography color={q.is_correct ? 'success.main' : 'error.main'}>
                            Ваш ответ: {Array.isArray(q.user_answers) ? q.user_answers.join(', ') : q.user_answers}
                        </Typography>
                        {!q.is_correct && (
                            <Typography color="text.secondary">
                                Правильный ответ: {Array.isArray(q.correct_answers) ? q.correct_answers.join(', ') : q.correct_answers}
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            ))}

            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Button variant="contained" onClick={() => router.push('/dashboard')}>
                    Вернуться на главную
                </Button>
            </Box>
        </Container>
    );
}