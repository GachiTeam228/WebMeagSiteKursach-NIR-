'use client';

import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Paper,
  Avatar,
  ListItemButton,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Divider,
  Collapse,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { ArrowBack, Folder, InsertDriveFile, CheckCircle, ExpandMore } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, use } from 'react';
import { format } from 'date-fns';

type TestStatus = 'not-assigned' | 'completed' | 'in-progress' | 'overdue';

type Test = {
  id: number;
  name: string;
  status?: TestStatus;
  score?: number;
  maxScore?: number;
  due?: string;
  completedAt?: string;
  type?: 'test' | 'homework' | 'lab' | 'exam';
  module?: string;
};

type Chapter = {
  id: number;
  title: string;
  tests: Test[];
};

type DisciplineType = {
  id: number;
  name: string;
  description: string;
  chapters: Chapter[];
};

type StudentProgress = {
  studentId: number;
  studentName: string;
  disciplineId: number;
  modules: {
    name: string;
    items: {
      id: number;
      name: string;
      type: string;
      score: number;
      maxScore: number;
      date: string;
      status: 'completed' | 'missed' | 'in-progress';
    }[];
    totalScore: number;
    maxTotalScore: number;
  }[];
  exam?: {
    score: number;
    maxScore: number;
  };
  totalScore: number;
  maxTotalScore: number;
};

export default function StudentDisciplinePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const disciplineId = resolvedParams.id;

  const [tabValue, setTabValue] = useState(0);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [discipline, setDiscipline] = useState<DisciplineType | null>(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'error' as 'error' | 'success',
  });

  const handleTestClick = (test: Test) => {
    switch (test.status) {
      case 'completed':
        router.push(`/tests/result/${test.id}`);
        break;
      case 'in-progress':
        router.push(`/tests/${test.id}`);
    }
  };

  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Загрузка прогресса при переключении на таб
  useEffect(() => {
    if (tabValue !== 1 || !disciplineId || progress !== null) return;

    const fetchProgress = async () => {
      setProgressLoading(true);
      try {
        const response = await fetch(`/api/discipline/${disciplineId}/progress`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        const data = await response.json();
        setProgress(data);
      } catch (error) {
        console.error('Error fetching progress:', error);
        setSnackbar({
          open: true,
          message: 'Ошибка при загрузке успеваемости',
          severity: 'error',
        });
      } finally {
        setProgressLoading(false);
      }
    };

    fetchProgress();
  }, [tabValue, disciplineId, progress]);

  // Загрузка структуры дисциплины
  useEffect(() => {
    if (!disciplineId) return;

    const fetchDiscipline = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/discipline/${disciplineId}/get`);
        if (!response.ok) {
          throw new Error('Failed to fetch discipline');
        }
        const data = await response.json();
        setDiscipline(data);

        // Раскрываем все главы по умолчанию
        const expanded: Record<number, boolean> = {};
        data.chapters?.forEach((chapter: Chapter) => {
          expanded[chapter.id] = true;
        });
        setExpandedChapters(expanded);
      } catch (error) {
        console.error('Error fetching discipline:', error);
        setSnackbar({
          open: true,
          message: 'Ошибка при загрузке дисциплины',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDiscipline();
  }, [disciplineId]);

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const getTestBadge = (test: Test) => {
    // Для назначенных тестов студента показываем статус
    if (!test.status) {
      return (
        <Chip
          label="Назначено"
          color="info"
          variant="outlined"
        />
      );
    }

    switch (test.status) {
      case 'completed':
        return (
          <Chip
            label={`${test.score}/${test.maxScore}`}
            color="success"
            variant="outlined"
            icon={<CheckCircle fontSize="small" />}
          />
        );
      case 'in-progress':
        return test.due ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`Срок: ${format(new Date(test.due), 'dd.MM.yyyy HH:mm')}`}
              color="warning"
              variant="outlined"
            />
          </Box>
        ) : (
          <Chip
            label="В процессе"
            color="warning"
            variant="outlined"
          />
        );
      case 'overdue':
        return test.due ? (
          <Chip
            label={`Просрочено: ${format(new Date(test.due), 'dd.MM.yyyy')}`}
            color="error"
            variant="outlined"
          />
        ) : null;
      case 'not-assigned':
      default:
        return (
          <Chip
            label="Не выдано"
            color="default"
            variant="outlined"
          />
        );
    }
  };

  if (loading) {
    return (
      <Container
        maxWidth="xl"
        sx={{ py: 4, display: 'flex', justifyContent: 'center', mt: 8 }}
      >
        <CircularProgress size={60} />
      </Container>
    );
  }

  if (!discipline) {
    return (
      <Container
        maxWidth="xl"
        sx={{ py: 4, textAlign: 'center' }}
      >
        <Typography
          variant="h5"
          color="error"
          sx={{ mt: 8 }}
        >
          Не удалось загрузить данные о дисциплине.
        </Typography>
        <IconButton
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          <ArrowBack />
        </IconButton>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="xl"
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
          {discipline.name}
        </Typography>
      </Box>

      <Typography
        color="text.secondary"
        sx={{ mb: 4 }}
      >
        {discipline.description}
      </Typography>

      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ mb: 4 }}
      >
        <Tab label="Структура курса" />
        <Tab label="Успеваемость" />
      </Tabs>

      {tabValue === 0 && (
        <Card elevation={3}>
          <CardContent>
            {discipline.chapters && discipline.chapters.length > 0 ? (
              discipline.chapters.map((chapter) => (
                <Paper
                  key={chapter.id}
                  elevation={2}
                  sx={{ mb: 2 }}
                >
                  <ListItemButton onClick={() => toggleChapter(chapter.id)}>
                    <Folder sx={{ mr: 2, color: 'text.secondary' }} />
                    <ListItemText
                      primary={chapter.title}
                      sx={{ flexGrow: 1 }}
                    />
                    <ExpandMore
                      sx={{
                        transform: expandedChapters[chapter.id] ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </ListItemButton>
                  <Collapse in={expandedChapters[chapter.id]}>
                    {chapter.tests && chapter.tests.length > 0 ? (
                      <List
                        dense
                        disablePadding
                        sx={{ pl: 4 }}
                      >
                        {chapter.tests.map((test) => (
                          <ListItem key={test.id}>
                            <ListItemButton onClick={() => handleTestClick(test)}>
                              <Avatar
                                sx={{
                                  bgcolor: 'background.default',
                                  width: 24,
                                  height: 24,
                                  mr: 2,
                                }}
                              >
                                <InsertDriveFile
                                  color="primary"
                                  fontSize="small"
                                />
                              </Avatar>
                              <ListItemText primary={test.name} />
                              {getTestBadge(test)}
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Box sx={{ p: 2, pl: 4, color: 'text.secondary' }}>
                        <Typography variant="body2">В этой главе нет доступных тестов.</Typography>
                      </Box>
                    )}
                  </Collapse>
                </Paper>
              ))
            ) : (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography>В этой дисциплине пока нет материалов.</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <Card elevation={3}>
          <CardContent>
            <Typography
              variant="h6"
              sx={{ mb: 3, fontWeight: 600 }}
            >
              Успеваемость по дисциплине
            </Typography>

            {progressLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : progress ? (
              <>
                <Box sx={{ mb: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ mb: 1 }}
                  >
                    Общий прогресс: {progress.totalScore} / {progress.maxTotalScore} баллов
                  </Typography>
                  <Box
                    width="100%"
                    bgcolor="#e0e0e0"
                    borderRadius={1}
                  >
                    <Box
                      width={`${
                        progress.maxTotalScore > 0 ? (progress.totalScore / progress.maxTotalScore) * 100 : 0
                      }%`}
                      height={10}
                      bgcolor={
                        progress.maxTotalScore > 0 && progress.totalScore / progress.maxTotalScore > 0.6
                          ? '#4caf50'
                          : '#ff9800'
                      }
                      borderRadius={1}
                    />
                  </Box>
                </Box>

                <TableContainer
                  component={Paper}
                  sx={{ overflowX: 'auto' }}
                >
                  <Table sx={{ minWidth: 800 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Модуль</TableCell>
                        <TableCell>Работа</TableCell>
                        <TableCell align="right">Баллы</TableCell>
                        <TableCell align="right">Макс. балл</TableCell>
                        <TableCell align="right">Дата</TableCell>
                        <TableCell>Статус</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {progress.modules && progress.modules.length > 0 ? (
                        <>
                          {progress.modules.map((module, moduleIndex) => (
                            <React.Fragment key={`module-${moduleIndex}`}>
                              {module.items.map((item, itemIndex) => (
                                <TableRow key={`item-${item.id}-${itemIndex}`}>
                                  <TableCell>{module.name}</TableCell>
                                  <TableCell>{item.name}</TableCell>
                                  <TableCell align="right">{item.score}</TableCell>
                                  <TableCell align="right">{item.maxScore}</TableCell>
                                  <TableCell align="right">
                                    {item.date ? format(new Date(item.date), 'dd.MM.yyyy') : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {item.status === 'completed' && (
                                      <Chip
                                        label="Завершено"
                                        color="success"
                                        size="small"
                                      />
                                    )}
                                    {item.status === 'in-progress' && (
                                      <Chip
                                        label="В процессе"
                                        color="warning"
                                        size="small"
                                      />
                                    )}
                                    {item.status === 'missed' && (
                                      <Chip
                                        label="Пропущено"
                                        color="error"
                                        size="small"
                                      />
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell
                                  colSpan={2}
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  Итого по модулю
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  {module.totalScore}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ fontWeight: 'bold' }}
                                >
                                  {module.maxTotalScore}
                                </TableCell>
                                <TableCell colSpan={2}>
                                  <Box
                                    width="150px"
                                    bgcolor="#e0e0e0"
                                    borderRadius={1}
                                  >
                                    <Box
                                      width={`${
                                        module.maxTotalScore > 0 ? (module.totalScore / module.maxTotalScore) * 100 : 0
                                      }%`}
                                      height={8}
                                      bgcolor={
                                        module.maxTotalScore > 0 && module.totalScore / module.maxTotalScore > 0.6
                                          ? '#4caf50'
                                          : '#ff9800'
                                      }
                                      borderRadius={1}
                                    />
                                  </Box>
                                </TableCell>
                              </TableRow>
                              {moduleIndex < progress.modules.length - 1 && (
                                <TableRow>
                                  <TableCell
                                    colSpan={6}
                                    sx={{ p: 0 }}
                                  >
                                    <Divider />
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))}

                          {progress.exam && (
                            <>
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  sx={{ p: 0 }}
                                >
                                  <Divider />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Экзамен</TableCell>
                                <TableCell>Итоговый экзамен</TableCell>
                                <TableCell align="right">{progress.exam.score}</TableCell>
                                <TableCell align="right">{progress.exam.maxScore}</TableCell>
                                <TableCell align="right">-</TableCell>
                                <TableCell>
                                  {progress.exam.score > 0 ? (
                                    <Chip
                                      label="Сдан"
                                      color="success"
                                      size="small"
                                    />
                                  ) : (
                                    <Chip
                                      label="Не сдан"
                                      color="error"
                                      size="small"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            </>
                          )}

                          <TableRow>
                            <TableCell
                              colSpan={6}
                              sx={{ p: 0 }}
                            >
                              <Divider />
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell
                              colSpan={2}
                              sx={{ fontWeight: 'bold' }}
                            >
                              Общий итог
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 'bold' }}
                            >
                              {progress.totalScore}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 'bold' }}
                            >
                              {progress.maxTotalScore}
                            </TableCell>
                            <TableCell colSpan={2}>
                              <Box
                                width="150px"
                                bgcolor="#e0e0e0"
                                borderRadius={1}
                              >
                                <Box
                                  width={`${
                                    progress.maxTotalScore > 0
                                      ? (progress.totalScore / progress.maxTotalScore) * 100
                                      : 0
                                  }%`}
                                  height={8}
                                  bgcolor={
                                    progress.maxTotalScore > 0 && progress.totalScore / progress.maxTotalScore > 0.6
                                      ? '#4caf50'
                                      : '#ff9800'
                                  }
                                  borderRadius={1}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}
                          >
                            <Typography>Нет данных об успеваемости</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography>Не удалось загрузить данные об успеваемости</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
