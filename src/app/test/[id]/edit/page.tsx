"use client";
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
  Grid,
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
} from "@mui/material";
import {
  Add,
  Close,
  Delete,
  RadioButtonChecked,
  CheckBox,
  ArrowBack,
  AccessTime,
  Quiz,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { use } from "react";

export default function EditTestPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [testData, setTestData] = useState({
    id: resolvedParams.id,
    title: "Новый тест",
    chapter: { id: 1, name: "Основные понятия электромеханики" },
    duration: 60,
    maxScore: 0,
    questions: [] as Array<{
      id: number;
      type: "single" | "multiple";
      text: string;
      points: number;
      options: Array<{ id: number; text: string; isCorrect: boolean }>;
    }>,
  });

  // Подсчет максимального количества баллов
  useEffect(() => {
    const totalPoints = testData.questions.reduce(
      (sum, question) => sum + (question.points || 0),
      0
    );
    setTestData((prev) => ({ ...prev, maxScore: totalPoints }));
  }, [testData.questions]);

  const addQuestion = (type: "single" | "multiple") => {
    const newQuestion = {
      id: Date.now(),
      type,
      text: "",
      points: 1,
      options: [
        { id: 1, text: "", isCorrect: false },
        { id: 2, text: "", isCorrect: false },
      ],
    };
    setTestData({
      ...testData,
      questions: [...testData.questions, newQuestion],
    });
  };

  const removeQuestion = (id: number) => {
    setTestData({
      ...testData,
      questions: testData.questions.filter((q) => q.id !== id),
    });
  };

  const addOption = (questionId: number) => {
    setTestData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [
                ...q.options,
                { id: Date.now(), text: "", isCorrect: false },
              ],
            }
          : q
      ),
    }));
  };

  const removeOption = (questionId: number, optionId: number) => {
    setTestData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.filter((o) => o.id !== optionId),
            }
          : q
      ),
    }));
  };

  const handleOptionChange = (
    questionId: number,
    optionId: number,
    field: "text" | "isCorrect",
    value: any
  ) => {
    setTestData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;

        if (q.type === "single" && field === "isCorrect" && value === true) {
          // Для вопросов с одним правильным ответом, сбрасываем флаг isCorrect у всех других опций
          return {
            ...q,
            options: q.options.map((o) =>
              o.id === optionId
                ? { ...o, isCorrect: true }
                : { ...o, isCorrect: false }
            ),
          };
        }

        return {
          ...q,
          options: q.options.map((o) =>
            o.id === optionId ? { ...o, [field]: value } : o
          ),
        };
      }),
    }));
  };

  const handleQuestionChange = (
    questionId: number,
    field: "text" | "points",
    value: any
  ) => {
    setTestData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              [field]: field === "points" ? parseInt(value) || value : value,
            }
          : q
      ),
    }));
  };

  const handlePointsBlur = (questionId: number, value: string) => {
    const points = parseInt(value) || 0;
    if (isNaN(points) || points <= 0) {
      handleQuestionChange(questionId, "points", 1);
    }
  };

  const handleSave = () => {
    console.log("Saving test:", testData);
    router.push("/discipline/1");
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {resolvedParams.id === "new"
            ? "Создание теста"
            : "Редактирование теста"}
        </Typography>
      </Box>

      {/* Основная информация о тесте */}
      <Card elevation={3} sx={{ mb: 4 }}>
        <CardContent>
          <Stack spacing={3}>
            <TextField
              label="Название теста"
              fullWidth
              multiline
              minRows={1}
              maxRows={10}
              value={testData.title}
              onChange={(e) =>
                setTestData({ ...testData, title: e.target.value })
              }
            />
            <FormControl fullWidth>
              <InputLabel>Длительность</InputLabel>
              <Select
                value={testData.duration}
                onChange={(e) =>
                  setTestData({
                    ...testData,
                    duration: e.target.value as number,
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

            <Typography variant="body1">
              Раздел: <strong>{testData.chapter.name}</strong>
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Статистика теста */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Chip
          label={`Вопросов: ${testData.questions.length}`}
          color="default"
          variant="outlined"
          icon={<Quiz fontSize="small" />}
        />
        <Chip
          label={`Макс. баллов: ${testData.maxScore}`}
          color="primary"
          variant="outlined"
        />
        <Chip
          label={
            testData.duration === 0
              ? "Без ограничения времени"
              : `Длительность: ${testData.duration} мин`
          }
          icon={<AccessTime fontSize="small" />}
          variant="outlined"
        />
      </Box>

      {/* Список вопросов */}
      {testData.questions.map((question, index) => (
        <Card key={question.id} elevation={2} sx={{ mb: 3 }}>
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
                minRows={1}
                maxRows={10}
                value={question.text}
                onChange={(e) =>
                  handleQuestionChange(question.id, "text", e.target.value)
                }
              />

              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <TextField
                  label="Баллы за вопрос"
                  type="number"
                  value={question.points}
                  onChange={(e) =>
                    handleQuestionChange(question.id, "points", e.target.value)
                  }
                  onBlur={(e) => handlePointsBlur(question.id, e.target.value)}
                  sx={{ width: 140 }}
                />
              </Box>

              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Варианты ответов:
              </Typography>

              {question.options.map((option) => (
                <Paper key={option.id} elevation={0} sx={{ p: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {question.type === "single" ? (
                      <Radio
                        checked={option.isCorrect}
                        onChange={() =>
                          handleOptionChange(
                            question.id,
                            option.id,
                            "isCorrect",
                            true
                          )
                        }
                      />
                    ) : (
                      <Checkbox
                        checked={option.isCorrect}
                        onChange={(e) =>
                          handleOptionChange(
                            question.id,
                            option.id,
                            "isCorrect",
                            e.target.checked
                          )
                        }
                      />
                    )}

                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      multiline
                      minRows={1}
                      maxRows={5}
                      value={option.text}
                      onChange={(e) =>
                        handleOptionChange(
                          question.id,
                          option.id,
                          "text",
                          e.target.value
                        )
                      }
                    />

                    {question.options.length > 2 && (
                      <IconButton
                        onClick={() => removeOption(question.id, option.id)}
                        size="small"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Paper>
              ))}

              <Button
                startIcon={<Add />}
                onClick={() => addOption(question.id)}
                sx={{ alignSelf: "flex-start" }}
              >
                Добавить вариант
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {/* Кнопки добавления вопросов */}
      <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
        <Button
          variant="contained"
          startIcon={<RadioButtonChecked />}
          onClick={() => addQuestion("single")}
          sx={{ flex: 1 }}
        >
          Один вариант
        </Button>
        <Button
          variant="contained"
          startIcon={<CheckBox />}
          onClick={() => addQuestion("multiple")}
          sx={{ flex: 1 }}
        >
          Несколько вариантов
        </Button>
      </Box>

      {/* Кнопки сохранения */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
        <Button variant="outlined" onClick={() => router.back()}>
          Отменить
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={testData.questions.length === 0}
        >
          Применить изменения
        </Button>
      </Box>
    </Container>
  );
}
