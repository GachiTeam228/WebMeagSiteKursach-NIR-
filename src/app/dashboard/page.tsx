"use client";

import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  TextField,
} from "@mui/material";
import {
  Quiz,
  School,
  Person,
  TimerOutlined,
  AccessTime,
  Close,
  Lock,
  Logout,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format, differenceInSeconds } from "date-fns";

export default function StudentDashboard() {
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [testStartDialogOpen, setTestStartDialogOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );

  const activeTests = [
    {
      id: 1,
      name: "Сортировки и поиск",
      discipline: "Алгоритмы",
      due: "2025-05-25T22:39:00",
      group: "CS-201",
      questions: 15,
      maxScore: 100,
      duration: 90,
    },
    {
      id: 2,
      name: "Нормальные формы",
      discipline: "Базы данных",
      due: "2025-05-28T23:59:00",
      group: "CS-202",
      questions: 10,
      maxScore: 80,
      duration: 60,
    },
  ];

  const disciplines = [
    {
      id: 1,
      name: "Алгоритмы и структуры данных",
      tests: 5,
      lastActivity: "2025-05-20",
    },
    {
      id: 2,
      name: "Базы данных",
      tests: 3,
      lastActivity: "2025-05-15",
    },
  ];

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

    return `${hours > 0 ? pad(hours) + ":" : ""}${pad(mins)}:${pad(secs)}`;
  };

  const handleTestClick = (testId: number) => {
    setSelectedTestId(testId);
    setTestStartDialogOpen(true);
  };

  const startTest = () => {
    if (selectedTestId) {
      router.push(`/test/${selectedTestId}`);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Профиль пользователя */}
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 32,
          pr: 4,
          width: "calc(100% - 32px)",
          maxWidth: 1200,
          display: "flex",
          justifyContent: "flex-end",
          zIndex: 1000,
        }}
      >
        <Card
          variant="outlined"
          sx={{ width: 200, cursor: "pointer" }}
          onClick={handleUserMenuOpen}
        >
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Avatar sx={{ bgcolor: "primary.main", mr: 2 }}>
                <Person />
              </Avatar>
              <Typography variant="subtitle1">Иванов И.И.</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Студент
            </Typography>
          </CardContent>
        </Card>

        <Menu
          anchorEl={userMenuAnchorEl}
          open={Boolean(userMenuAnchorEl)}
          onClose={handleUserMenuClose}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: "visible",
              filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
              mt: 1.5,
              "& .MuiAvatar-root": {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              "&:before": {
                content: '""',
                display: "block",
                position: "absolute",
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: "background.paper",
                transform: "translateY(-50%) rotate(45deg)",
                zIndex: 0,
              },
            },
          }}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        >
          <MenuItem
            onClick={() => {
              setChangePasswordOpen(true);
              handleUserMenuClose();
            }}
          >
            <Lock fontSize="small" sx={{ mr: 1 }} />
            Изменить пароль
          </MenuItem>
          <MenuItem
            onClick={() => {
              console.log("Logout");
              handleUserMenuClose();
            }}
          >
            <Logout fontSize="small" sx={{ mr: 1 }} />
            Выйти
          </MenuItem>
        </Menu>
      </Box>

      {/* Основной контент */}
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 4 }}>
          Панель студента
        </Typography>

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ mb: 4 }}
        >
          <Tab label="Активные тесты" icon={<Quiz />} />
          <Tab label="Дисциплины" icon={<School />} />
        </Tabs>

        {tabValue === 0 && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Текущие активные тесты
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {activeTests.map((test) => (
                  <Card
                    variant="outlined"
                    key={test.id}
                    sx={{ width: "100%", cursor: "pointer" }}
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
                        {test.discipline} | Группа: {test.group}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          mb: 2,
                          flexWrap: "wrap",
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
                          label={`Длительность: ${test.duration} мин`}
                          variant="outlined"
                          size="small"
                          icon={<AccessTime fontSize="small" />}
                        />
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <Chip
                          label={`Срок: ${format(
                            new Date(test.due),
                            "dd.MM.yyyy HH:mm"
                          )}`}
                          variant="outlined"
                          color="primary"
                        />
                        <Chip
                          icon={<TimerOutlined />}
                          label={`Осталось: ${calculateTimeLeft(test.due)}`}
                          color={
                            differenceInSeconds(
                              new Date(test.due),
                              new Date()
                            ) < 3600
                              ? "error"
                              : "primary"
                          }
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {tabValue === 1 && (
          <Grid container spacing={3}>
            {disciplines.map((discipline) => (
              <Grid item xs={12} sm={6} md={4} key={discipline.id}>
                <Card
                  variant="outlined"
                  sx={{ cursor: "pointer", "&:hover": { boxShadow: 2 } }}
                  onClick={() => router.push(`/discipline/${discipline.id}`)}
                >
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {discipline.name}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                      <Chip
                        label={`${discipline.tests} тестов`}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
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
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Вы собираетесь начать выполнение теста. Обратите внимание:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Тест имеет ограничение по времени" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• После начала теста таймер не останавливается" />
            </ListItem>
          </List>
          <Typography sx={{ mt: 2, fontWeight: 600 }}>
            Вы уверены, что готовы начать?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestStartDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={startTest}>
            Начать тест
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог изменения пароля */}
      <Dialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      >
        <DialogTitle>
          Изменить пароль
          <IconButton
            onClick={() => setChangePasswordOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
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
          />
          <TextField
            margin="dense"
            label="Новый пароль"
            type="password"
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Подтвердите новый пароль"
            type="password"
            fullWidth
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Логика изменения пароля
              setChangePasswordOpen(false);
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
