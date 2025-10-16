'use client';

import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Quiz, School, TimerOutlined, AccessTime, Close } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { format, differenceInSeconds } from 'date-fns';
import UserHeader from '../shared/UserHeader/UserHeader';

interface Me {
  first_name: string;
  last_name: string;
  role_id: number;
}

interface Discipline {
  id: number;
  name: string;
  tests: number;
}

interface ActiveTest {
  id: number;
  name: string;
  discipline: string;
  due: string;
  groups: string; // или groups, в зависимости от ответа API
  questions: number;
  maxScore: number;
  duration: number;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [testStartDialogOpen, setTestStartDialogOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState<boolean>(false);
  const [logout, setLogout] = useState<boolean>(false);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [passwords, setPasswords] = useState<{ currentPass: string; newPass: string; confirmNewPass: string }>({
    currentPass: '',
    newPass: '',
    confirmNewPass: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const [activeTests, setActiveTests] = useState<ActiveTest[]>([]);
  const [isLoadingActiveTests, setIsLoadingActiveTests] = useState(false);

  const [disciplines, setDisciplines] = useState<Discipline[]>([]);

  const calculateTimeLeft = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const seconds = differenceInSeconds(due, now);
    return formatTime(seconds);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 60 / 60);
    const mins = Math.floor((seconds / 60) % 60);
    const secs = seconds % 60;

    const pad = (num: number) => (num < 10 ? `0${num}` : num);

    return `${hours > 0 ? pad(hours) + ':' : ''}${pad(mins)}:${pad(secs)}`;
  };

  const handleTestClick = (testId: number) => {
    setSelectedTestId(testId);
    setTestStartDialogOpen(true);
  };

  const handlePasswordChange = async () => {
    const { currentPass, newPass, confirmNewPass } = passwords;

    try {
      if (newPass !== confirmNewPass) {
        throw new Error('Пароли не совпадают');
      }

      const response = await fetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPass, newPass, confirmNewPass }),
      });

      if (!response.ok) {
        throw new Error('Ошибка смены пароля');
      }

      setChangePasswordOpen(false);
      setSnackbar({
        open: true,
        message: 'Пароль успешно изменён',
        severity: 'success',
      });
    } catch (e) {
      return e;
    }
  };

  const startTest = () => {
    if (selectedTestId) {
      router.push(`/tests/${selectedTestId}`);
    }
  };

  // 1. Сохраняем текущее время в стейте
  const [, setNow] = useState<Date | null>(null);

  // 2. Обновляем его каждую секунду только на клиенте
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tabValue !== 0 || activeTests.length !== 0) return;

    const fetchActiveTests = async () => {
      setIsLoadingActiveTests(true);
      try {
        const response = await fetch('/api/test/active');
        if (!response.ok) {
          throw new Error('Failed to fetch active tests');
        }
        const data = await response.json();
        setActiveTests(data);
      } catch {
        setSnackbar({
          open: true,
          message: 'Ошибка при загрузке активных тестов',
          severity: 'error',
        });
      } finally {
        setIsLoadingActiveTests(false);
      }
    };

    fetchActiveTests();
  }, [tabValue]);

  // Загрузка дисциплин с бэкенда
  useEffect(() => {
    if (tabValue !== 1 || disciplines.length !== 0) return;

    const fetchDisciplines = async () => {
      setIsLoadingDisciplines(true);
      try {
        const response = await fetch('/api/discipline/my');
        if (!response.ok) {
          throw new Error('Failed to fetch disciplines');
        }
        const data = await response.json();
        setDisciplines(data.subjects); // исправлено здесь
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        setSnackbar({
          open: true,
          message: 'Ошибка при загрузке дисциплин',
          severity: 'error',
        });
      } finally {
        setIsLoadingDisciplines(false);
      }
    };

    fetchDisciplines();
  }, [tabValue]);

  useEffect(() => {
    if (!logout) return;

    const fetchLogout = async () => {
      try {
        const response = await fetch('/api/logout', {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error('Failed to logout');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        setSnackbar({
          open: true,
          message: 'Ошибка при попытке выхода из аккаунта',
          severity: 'error',
        });
      }

      router.push('/auth/login');
    };

    fetchLogout();
  }, [logout]);

  useEffect(() => {
    if (me !== null) return;

    const fetchMe = async () => {
      setMeLoading(true);
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch disciplines');
        }
        const data: Me = await response.json();
        setMe(data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        setSnackbar({
          open: true,
          message: 'Ошибка при загрузке пользователя',
          severity: 'error',
        });
      } finally {
        setMeLoading(false);
      }
    };

    fetchMe();
  }, [me]);

  return (
    <Container
      maxWidth="xl"
      sx={{ py: 4 }}
    >
      {/* Профиль пользователя */}
      <UserHeader
        me={me}
        meLoading={meLoading}
        onLogout={() => setLogout(true)}
        onChangePassword={() => setChangePasswordOpen(true)}
        // onChangePassword={handlePasswordChange}
      />

      {/* Основной контент */}
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, mb: 4 }}
        >
          Панель студента
        </Typography>

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ mb: 4 }}
        >
          <Tab
            label="Активные тесты"
            icon={<Quiz />}
          />
          <Tab
            label="Дисциплины"
            icon={<School />}
          />
        </Tabs>

        {tabValue === 0 && (
          <Card variant="outlined">
            <CardContent>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, mb: 3 }}
              >
                Текущие активные тесты
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {isLoadingActiveTests ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : activeTests.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 4, color: 'text.secondary' }}>
                    <Quiz sx={{ fontSize: 48, mb: 2 }} />
                    <Typography>Активных тестов нет</Typography>
                  </Box>
                ) : (
                  activeTests.map((test) => (
                    <Card
                      variant="outlined"
                      key={test.id}
                      sx={{ width: '100%', cursor: 'pointer' }}
                      onClick={() => handleTestClick(test.id)}
                    >
                      <CardContent>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600, mb: 1 }}
                        >
                          {test.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
                          {test.discipline} | Группа: {test.groups}
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            mb: 2,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Chip
                            label={`Вопросов: ${test.questions}`}
                            variant="outlined"
                            size="small"
                            icon={<Quiz fontSize="small" />}
                          />
                          <Chip
                            label={`Макс. баллов: ${test.maxScore}`}
                            variant="outlined"
                            size="small"
                            color="primary"
                          />
                          <Chip
                            label={`Длительность: ${test.duration ? test.duration + ' мин' : 'без ограничения'}`}
                            variant="outlined"
                            size="small"
                            icon={<AccessTime fontSize="small" />}
                          />
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <Chip
                            label={`Срок: ${format(new Date(test.due), 'dd.MM.yyyy HH:mm')}`}
                            variant="outlined"
                            color="primary"
                          />
                          <Chip
                            icon={<TimerOutlined />}
                            label={`Осталось: ${calculateTimeLeft(test.due)}`}
                            color={differenceInSeconds(new Date(test.due), new Date()) < 3600 ? 'error' : 'primary'}
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {tabValue === 1 && (
          <Grid
            container
            spacing={3}
          >
            {isLoadingDisciplines ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  p: 4,
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              disciplines.map((discipline) => (
                <Grid
                  sx={{ width: { xs: '100%', sm: '50%', md: '33.33%' } }}
                  key={discipline.id}
                >
                  <Card
                    variant="outlined"
                    sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
                    onClick={() => router.push(`/discipline/${discipline.id}`)}
                  >
                    <CardContent>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 600, mb: 1 }}
                      >
                        {discipline.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip
                          label={`${discipline.tests} тестов`}
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        )}
      </Box>

      {/* Диалог подтверждения начала теста */}
      <Dialog
        open={testStartDialogOpen}
        onClose={() => setTestStartDialogOpen(false)}
      >
        <DialogTitle>
          Начало тестирования
          <IconButton
            onClick={() => setTestStartDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Вы собираетесь начать выполнение теста. Обратите внимание:</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Тест имеет ограничение по времени" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• После начала теста таймер не останавливается" />
            </ListItem>
          </List>
          <Typography sx={{ mt: 2, fontWeight: 600 }}>Вы уверены, что готовы начать?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestStartDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={startTest}
          >
            Начать тест
          </Button>
        </DialogActions>
      </Dialog>

      {/* Попап смены пароля */}
      <Dialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      >
        <DialogTitle>
          Изменить пароль
          <IconButton
            onClick={() => setChangePasswordOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Текущий пароль"
            type="password"
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
            name="currentPass"
            value={passwords.currentPass}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Новый пароль"
            type="password"
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
            name="newPass"
            value={passwords.newPass}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            label="Подтвердите новый пароль"
            type="password"
            fullWidth
            variant="outlined"
            name="confirmNewPass"
            value={passwords.confirmNewPass}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={() => {
              handlePasswordChange();
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Снэкбар для уведомлений */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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
  );
}
