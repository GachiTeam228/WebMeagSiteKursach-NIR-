// app/discipline/[id]/group/[groupId]/progress/page.tsx

'use client';

import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  HourglassEmpty,
  Warning,
  Block,
  AutoGraph, // Иконка для кнопки СППР
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import StudentAnalytics from '../../../../../components/StudentAnalytics';

type TestResult = {
  testId: number;
  testName: string;
  maxScore: number;
  score: number | null;
  status: 'completed' | 'in-progress' | 'overdue' | 'not-started' | 'not-assigned';
  completedAt: string | null;
};

type StudentProgress = {
  studentId: number;
  studentName: string;
  email: string;
  testResults: TestResult[];
  totalScore: number;
  maxTotalScore: number;
};

type Chapter = {
  name: string;
  tests: {
    id: number;
    title: string;
    maxScore: number;
  }[];
};

type GroupProgressData = {
  discipline: {
    id: number;
    name: string;
  };
  group: {
    id: number;
    name: string;
  };
  chapters: Chapter[];
  students: StudentProgress[];
};

export default function GroupProgressPage({ params }: { params: Promise<{ id: string; groupId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { id, groupId } = resolvedParams;

  const [data, setData] = useState<GroupProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'error' as 'error' | 'success',
  });

  // Состояние для открытия модального окна аналитики
  const [selectedStudentForAnalytics, setSelectedStudentForAnalytics] = useState<StudentProgress | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/discipline/${id}/groups/${groupId}/progress`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching group progress:', error);
        setSnackbar({
          open: true,
          message: 'Ошибка при загрузке данных',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [id, groupId]);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'completed':
        return (
          <CheckCircle
            fontSize="small"
            color="success"
          />
        );
      case 'in-progress':
        return (
          <HourglassEmpty
            fontSize="small"
            color="warning"
          />
        );
      case 'overdue':
        return (
          <Warning
            fontSize="small"
            color="error"
          />
        );
      case 'not-started':
        return (
          <Block
            fontSize="small"
            color="disabled"
          />
        );
      case 'not-assigned':
        return (
          <Block
            fontSize="small"
            sx={{ color: 'text.disabled' }}
          />
        );
    }
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'error';
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

  if (!data) {
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
          Не удалось загрузить данные
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
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700 }}
          >
            Успеваемость группы {data.group.name}
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
          >
            Дисциплина: {data.discipline.name}
          </Typography>
        </Box>
      </Box>

      <Card elevation={3}>
        <CardContent>
          <TableContainer
            component={Paper}
            sx={{ overflowX: 'auto' }}
          >
            <Table
              sx={{ minWidth: 1200 }}
              size="small"
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      bgcolor: 'background.paper',
                      zIndex: 3,
                      fontWeight: 'bold',
                      minWidth: 200,
                    }}
                  >
                    Студент
                  </TableCell>
                  {data.chapters.map((chapter) =>
                    chapter.tests.map((test) => (
                      <TableCell
                        key={test.id}
                        align="center"
                        sx={{ minWidth: 100 }}
                      >
                        <Tooltip title={test.title}>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', fontWeight: 600 }}
                            >
                              {test.title.length > 15 ? test.title.substring(0, 15) + '...' : test.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              ({test.maxScore})
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                    ))
                  )}
                  <TableCell
                    align="center"
                    sx={{
                      bgcolor: 'background.paper',
                      zIndex: 3,
                      fontWeight: 'bold',
                      minWidth: 120,
                    }}
                  >
                    Итого
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.students.map((student, idx) => (
                  <TableRow
                    key={student.studentId}
                    hover
                  >
                    <TableCell
                      sx={{
                        bgcolor: 'background.paper',
                        zIndex: 2,
                      }}
                    >
                      {/* Flex-контейнер для имени и кнопки аналитики */}
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 500 }}
                          >
                            {`${idx + 1}. ` + student.studentName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {student.email}
                          </Typography>
                        </Box>
                        <Tooltip title="Открыть СППР-профиль">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setSelectedStudentForAnalytics(student)}
                          >
                            <AutoGraph fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>

                    {student.testResults.map((result) => (
                      <TableCell
                        key={result.testId}
                        align="center"
                      >
                        {result.status === 'not-assigned' ? (
                          <Tooltip title="Не назначен">
                            <span>-</span>
                          </Tooltip>
                        ) : result.score !== null ? (
                          <Tooltip title={`Завершено: ${result.completedAt || 'N/A'}`}>
                            <Chip
                              label={result.score}
                              size="small"
                              color={getScoreColor(result.score, result.maxScore)}
                              icon={getStatusIcon(result.status)}
                            />
                          </Tooltip>
                        ) : (
                          <Tooltip title={result.status === 'overdue' ? 'Просрочено' : 'Не начат'}>
                            <span>{getStatusIcon(result.status)}</span>
                          </Tooltip>
                        )}
                      </TableCell>
                    ))}

                    <TableCell
                      align="center"
                      sx={{
                        bgcolor: 'background.paper',
                        zIndex: 2,
                        fontWeight: 'bold',
                      }}
                    >
                      <Chip
                        label={`${student.totalScore}/${student.maxTotalScore}`}
                        color={
                          student.maxTotalScore > 0
                            ? getScoreColor(student.totalScore, student.maxTotalScore)
                            : 'default'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<CheckCircle />}
              label="Завершено"
              size="small"
            />
            <Chip
              icon={<HourglassEmpty />}
              label="В процессе"
              size="small"
            />
            <Chip
              icon={<Warning />}
              label="Просрочено"
              size="small"
            />
            <Chip
              icon={<Block />}
              label="Не начат"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

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

      {/* Модальное окно с ИИ-Аналитикой */}
      <Dialog
        open={!!selectedStudentForAnalytics}
        onClose={() => setSelectedStudentForAnalytics(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Детальный профиль студента
          <Button onClick={() => setSelectedStudentForAnalytics(null)}>Закрыть</Button>
        </DialogTitle>
        <DialogContent dividers>
          {selectedStudentForAnalytics && (
            <StudentAnalytics
              studentId={selectedStudentForAnalytics.studentId}
              studentName={selectedStudentForAnalytics.studentName}
              disciplineId={parseInt(id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
