'use client';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Radio,
  Checkbox,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add, Close, Delete, RadioButtonChecked, CheckBox, ArrowBack, Quiz } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ru } from 'date-fns/locale';

// Интерфейсы для данных
interface Option {
  id: number;
  option_text: string;
  is_correct: boolean;
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single' | 'multiple';
  points: number;
  order_number: number;
  options: Option[];
}

interface TestData {
  id: number;
  title: string;
  time_limit_minutes: number | null;
  passing_score: number | null;
  chapter_name: string;
  questions: Question[];
}

export default function EditTestPage({ params }: { params: { id: string } }) {
  const { id: testId } = use(params);
  const router = useRouter();

  const [testData, setTestData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Загрузка данных теста
  useEffect(() => {
    const fetchTestData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/test/${testId}`);
        if (!response.ok) throw new Error('Failed to fetch test data');
        const data = await response.json();
        setTestData(data);
      } catch (error) {
        console.error(error);
        setSnackbar({ open: true, message: 'Ошибка загрузки теста', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchTestData();
  }, [testId]);

  const maxScore = testData?.questions.reduce((sum, q) => sum + (q.points || 0), 0) || 0;

  const addQuestion = (type: 'single' | 'multiple') => {
    if (!testData) return;
    const newQuestion: Question = {
      id: -Date.now(), // Временный отрицательный ID
      question_text: '',
      question_type: type,
      points: 1,
      order_number: testData.questions.length,
      options: [
        { id: -Date.now() - 1, option_text: '', is_correct: false },
        { id: -Date.now() - 2, option_text: '', is_correct: false },
      ],
    };
    setTestData({ ...testData, questions: [...testData.questions, newQuestion] });
  };

  const removeQuestion = (id: number) => {
    if (!testData) return;
    setTestData({ ...testData, questions: testData.questions.filter((q) => q.id !== id) });
  };

  const addOption = (questionId: number) => {
    if (!testData) return;
    setTestData({
      ...testData,
      questions: testData.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: [...q.options, { id: -Date.now(), option_text: '', is_correct: false }] }
          : q
      ),
    });
  };

  const removeOption = (questionId: number, optionId: number) => {
    if (!testData) return;
    setTestData({
      ...testData,
      questions: testData.questions.map((q) =>
        q.id === questionId ? { ...q, options: q.options.filter((o) => o.id !== optionId) } : q
      ),
    });
  };

  const handleOptionChange = (
    questionId: number,
    optionId: number,
    field: 'option_text' | 'is_correct',
    value: any
  ) => {
    if (!testData) return;
    setTestData({
      ...testData,
      questions: testData.questions.map((q) => {
        if (q.id !== questionId) return q;

        let newOptions = q.options;
        if (q.question_type === 'single' && field === 'is_correct' && value === true) {
          newOptions = q.options.map((o) =>
            o.id === optionId ? { ...o, is_correct: true } : { ...o, is_correct: false }
          );
        } else {
          newOptions = q.options.map((o) => (o.id === optionId ? { ...o, [field]: value } : o));
        }
        return { ...q, options: newOptions };
      }),
    });
  };

  const handleQuestionChange = (questionId: number, field: 'question_text' | 'points', value: any) => {
    if (!testData) return;
    setTestData({
      ...testData,
      questions: testData.questions.map((q) =>
        q.id === questionId ? { ...q, [field]: field === 'points' ? parseInt(value) || 0 : value } : q
      ),
    });
  };

  const handleSave = async () => {
    if (!testData) return;
    setSaving(true);

    const dataToSave = {
      ...testData,
      questions: testData.questions.map((q, index) => ({
        ...q,
        order_number: index,
      })),
    };

    try {
      const response = await fetch(`/api/test/${testId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      if (!response.ok) throw new Error('Failed to save test');
      setSnackbar({ open: true, message: 'Тест успешно сохранен!', severity: 'success' });
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      console.error(error);
      setSnackbar({ open: true, message: 'Ошибка при сохранении теста', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!testData) {
    return (
      <Container sx={{ textAlign: 'center', mt: 8 }}>
        <Typography
          variant="h5"
          color="error"
        >
          Тест не найден или произошла ошибка.
        </Typography>
        <Button
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          Вернуться назад
        </Button>
      </Container>
    );
  }

  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={ru}
    >
      <Container
        maxWidth="md"
        sx={{ py: 4 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <IconButton
            onClick={() => router.back()}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700 }}
          >
            Редактирование теста
          </Typography>
        </Box>

        <Card
          elevation={3}
          sx={{ mb: 4 }}
        >
          <CardContent>
            <Stack spacing={3}>
              <TextField
                label="Название теста"
                fullWidth
                value={testData.title}
                onChange={(e) => setTestData({ ...testData, title: e.target.value })}
              />
              <FormControl fullWidth>
                <InputLabel>Длительность</InputLabel>
                <Select
                  value={testData.time_limit_minutes ?? 0}
                  onChange={(e) =>
                    setTestData({
                      ...testData,
                      time_limit_minutes: e.target.value === 0 ? null : Number(e.target.value),
                    })
                  }
                  label="Длительность"
                >
                  <MenuItem value={0}>Без ограничений</MenuItem>
                  <Divider />
                  <MenuItem value={15}>15 минут</MenuItem>
                  <MenuItem value={30}>30 минут</MenuItem>
                  <MenuItem value={45}>45 минут</MenuItem>
                  <MenuItem value={60}>1 час</MenuItem>
                  <MenuItem value={90}>1.5 часа</MenuItem>
                  <MenuItem value={120}>2 часа</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Проходной балл"
                type="number"
                value={testData.passing_score ?? ''}
                onChange={(e) =>
                  setTestData({ ...testData, passing_score: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
              <Typography variant="body1">
                Раздел: <strong>{testData.chapter_name}</strong>
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Chip
            label={`Вопросов: ${testData.questions.length}`}
            variant="outlined"
            icon={<Quiz fontSize="small" />}
          />
          <Chip
            label={`Макс. баллов: ${maxScore}`}
            color="primary"
            variant="outlined"
          />
        </Box>

        {testData.questions.map((question, index) => (
          <Card
            key={question.id}
            elevation={2}
            sx={{ mb: 3 }}
          >
            <CardHeader
              title={`Вопрос ${index + 1}`}
              action={
                <IconButton onClick={() => removeQuestion(question.id)}>
                  <Close />
                </IconButton>
              }
            />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="Текст вопроса"
                  fullWidth
                  multiline
                  value={question.question_text}
                  onChange={(e) => handleQuestionChange(question.id, 'question_text', e.target.value)}
                />
                <TextField
                  label="Баллы за вопрос"
                  type="number"
                  value={question.points}
                  onChange={(e) => handleQuestionChange(question.id, 'points', e.target.value)}
                  sx={{ width: 140 }}
                />
                <Typography
                  variant="subtitle2"
                  sx={{ mt: 1 }}
                >
                  Варианты ответов:
                </Typography>
                {question.options.map((option) => (
                  <Paper
                    key={option.id}
                    elevation={0}
                    sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    {question.question_type === 'single' ? (
                      <Radio
                        checked={option.is_correct}
                        onChange={() => handleOptionChange(question.id, option.id, 'is_correct', true)}
                      />
                    ) : (
                      <Checkbox
                        checked={option.is_correct}
                        onChange={(e) => handleOptionChange(question.id, option.id, 'is_correct', e.target.checked)}
                      />
                    )}
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={option.option_text}
                      onChange={(e) => handleOptionChange(question.id, option.id, 'option_text', e.target.value)}
                    />
                    {question.options.length > 2 && (
                      <IconButton
                        onClick={() => removeOption(question.id, option.id)}
                        size="small"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Paper>
                ))}
                <Button
                  startIcon={<Add />}
                  onClick={() => addOption(question.id)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Добавить вариант
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            variant="contained"
            startIcon={<RadioButtonChecked />}
            onClick={() => addQuestion('single')}
            sx={{ flex: 1 }}
          >
            Один вариант
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckBox />}
            onClick={() => addQuestion('multiple')}
            sx={{ flex: 1 }}
          >
            Несколько вариантов
          </Button>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => router.back()}
            disabled={saving}
          >
            Отменить
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || testData.questions.length === 0}
          >
            {saving ? <CircularProgress size={24} /> : 'Применить изменения'}
          </Button>
        </Box>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
}
