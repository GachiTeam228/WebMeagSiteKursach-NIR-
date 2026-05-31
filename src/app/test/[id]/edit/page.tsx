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
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add, Close, Delete, RadioButtonChecked, CheckBox, ArrowBack, Quiz } from '@mui/icons-material';
import TagSelectionModal from './TagSelectionModal';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ru } from 'date-fns/locale';
import ImageUpload from '@/app/shared/ImageUpload/ImageUpload';

// Интерфейсы для данных
interface Option {
  id: number;
  option_text: string;
  is_correct: boolean;
  image_url?: string | null;
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single' | 'multiple';
  points: number;
  order_number: number;
  image_url?: string | null; // Добавлено поле для изображения
  options: Option[];
  tags: string[];
}

interface TestData {
  id: number;
  title: string;
  time_limit_minutes: number | null;
  passing_score: number | null;
  chapter_name: string;
  questions: Question[];
}

export default function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = use(params);
  const router = useRouter();

  const [testData, setTestData] = useState<TestData | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalQuestionId, setTagModalQuestionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const isQuestionValid = (question: Question) => {
    return Boolean(question.question_text?.trim() || question.image_url);
  };

  const isOptionValid = (option: Option) => {
    return Boolean(option.option_text?.trim() || option.image_url);
  };

  const getValidationErrors = () => {
    if (!testData) return ['Тест ещё не загружен.'];

    const errors: string[] = [];

    testData.questions.forEach((question, questionIndex) => {
      const questionNumber = questionIndex + 1;

      if (!isQuestionValid(question)) {
        errors.push(`Вопрос ${questionNumber} должен содержать текст, изображение или оба.`);
      }

      if (!question.options.some((option) => option.is_correct)) {
        errors.push(`Вопрос ${questionNumber} должен иметь выбранный правильный вариант ответа.`);
      }

      question.options.forEach((option, optionIndex) => {
        if (!isOptionValid(option)) {
          errors.push(
            `Вопрос ${questionNumber}, вариант ${optionIndex + 1} должен содержать текст, изображение или оба.`
          );
        }
      });
    });

    return errors;
  };

  const hasInvalidData = () => {
    return getValidationErrors().length > 0;
  };

  // Загрузка данных теста
  useEffect(() => {
    const fetchTestData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/test/${testId}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to fetch test data');

        const normalizedQuestions = Array.isArray(result.questions)
          ? result.questions.map((q: any) => ({ ...q, tags: Array.isArray(q.tags) ? q.tags : [] }))
          : [];

        setTestData({ ...result, questions: normalizedQuestions });
        setAvailableTags(Array.isArray(result.all_tags) ? result.all_tags : []);
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
  const validationErrors = testData ? getValidationErrors() : [];

  const addQuestion = (type: 'single' | 'multiple') => {
    if (!testData) return;
    const newQuestion: Question = {
      id: -Date.now(), // Временный отрицательный ID
      question_text: '',
      question_type: type,
      points: 1,
      order_number: testData.questions.length,
      image_url: null, // Добавлено
      options: [
        { id: -Date.now() - 1, option_text: '', is_correct: false },
        { id: -Date.now() - 2, option_text: '', is_correct: false },
      ],
      tags: [],
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
    field: 'option_text' | 'is_correct' | 'image_url',
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
        q.id === questionId ? { ...q, [field]: field === 'points' ? parseInt(value) || '' : value } : q
      ),
    });
  };

  const openTagModal = (questionId: number) => {
    setTagModalQuestionId(questionId);
    setTagModalOpen(true);
  };

  const closeTagModal = () => {
    setTagModalOpen(false);
    setTagModalQuestionId(null);
  };

  const addTagToQuestion = (tag: string) => {
    if (!testData || tag.trim() === '' || tagModalQuestionId === null) return;

    const normalizedTag = tag.trim();
    setAvailableTags((prev) => Array.from(new Set([...prev, normalizedTag])));
    setTestData({
      ...testData,
      questions: testData.questions.map((q) =>
        q.id === tagModalQuestionId
          ? {
              ...q,
              tags: Array.from(new Set([...(q.tags || []), normalizedTag])),
            }
          : q
      ),
    });
  };

  const removeTagFromQuestion = (questionId: number, tag: string) => {
    if (!testData) return;
    setTestData({
      ...testData,
      questions: testData.questions.map((q) =>
        q.id === questionId ? { ...q, tags: q.tags.filter((existingTag) => existingTag !== tag) } : q
      ),
    });
  };

  // Новая функция для обработки изменения изображения
  const handleImageChange = (questionId: number, imageUrl: string | null) => {
    if (!testData) return;
    setTestData({
      ...testData,
      questions: testData.questions.map((q) => (q.id === questionId ? { ...q, image_url: imageUrl } : q)),
    });
  };

  const handleSave = async () => {
    if (!testData) return;

    const validationErrors = getValidationErrors();
    if (validationErrors.length > 0) {
      setSnackbar({
        open: true,
        message: validationErrors[0],
        severity: 'error',
      });
      return;
    }

    setSaving(true);

    const dataToSave = {
      ...testData,
      questions: testData.questions.map((q, index) => ({
        ...q,
        order_number: index,
        tags: q.tags || [],
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

                {/* Новый блок для загрузки изображения */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, color: 'text.secondary' }}
                  >
                    Изображение к вопросу (необязательно)
                  </Typography>
                  <ImageUpload
                    currentImageUrl={question.image_url || undefined}
                    onImageChange={(url) => handleImageChange(question.id, url)}
                    uploadType="question"
                  />
                </Box>

                <TextField
                  label="Баллы за вопрос"
                  type="number"
                  value={question.points}
                  onChange={(e) => handleQuestionChange(question.id, 'points', e.target.value)}
                  sx={{ width: 140 }}
                />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1 }}
                  >
                    Теги вопроса:
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      mb: 1,
                      maxWidth: '100%',
                      overflowX: 'auto',
                      py: 0.5,
                    }}
                  >
                    {question.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        variant="outlined"
                        onDelete={() => removeTagFromQuestion(question.id, tag)}
                      />
                    ))}
                    <Chip
                      label="Добавить тег"
                      color="primary"
                      variant="outlined"
                      onClick={() => openTagModal(question.id)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{ mt: 1 }}
                >
                  Варианты ответов:
                </Typography>
                {question.options.map((option) => (
                  <Box
                    key={option.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    <TextField
                      label="Текст варианта"
                      value={option.option_text}
                      onChange={(e) => handleOptionChange(question.id, option.id, 'option_text', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    {/* Компонент загрузки изображения */}
                    <ImageUpload
                      currentImageUrl={option.image_url || undefined}
                      onImageChange={(url) => handleOptionChange(question.id, option.id, 'image_url', url)}
                      uploadType="answerOption"
                    />
                    {/* Отображение картинки, если она есть */}
                    {/* {option.image_url && (
                      <img
                        src={option.image_url}
                        alt="Вариант"
                        style={{ maxHeight: 60, marginLeft: 8 }}
                      />
                    )} */}
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
                    {question.options.length > 2 && (
                      <IconButton
                        onClick={() => removeOption(question.id, option.id)}
                        size="small"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
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

        {validationErrors.length > 0 && (
          <Box sx={{ mb: 2, p: 2, borderRadius: 1, bgcolor: 'rgba(255, 0, 0, 0.05)' }}>
            <Typography
              variant="subtitle2"
              color="error"
              sx={{ mb: 1, fontWeight: 700 }}
            >
              Причины невозможности применить изменения:
            </Typography>
            <Stack
              component="ul"
              sx={{ pl: 3, m: 0, color: 'error.main' }}
            >
              {validationErrors.map((reason, index) => (
                <Typography
                  key={index}
                  component="li"
                  sx={{ display: 'list-item', mb: 0.5 }}
                >
                  {reason}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

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
            disabled={saving || testData?.questions.length === 0 || hasInvalidData()}
          >
            {saving ? <CircularProgress size={24} /> : 'Применить изменения'}
          </Button>
        </Box>

        <TagSelectionModal
          open={tagModalOpen}
          onClose={closeTagModal}
          availableTags={availableTags}
          questionTags={testData?.questions.find((q) => q.id === tagModalQuestionId)?.tags || []}
          onAddTag={addTagToQuestion}
        />

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
