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
  Collapse,
  Tabs,
  Tab,
  Divider,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Add,
  Quiz,
  Groups,
  AccessTime,
  School,
  Person,
  ExpandMore,
  MoreVert,
  Timer as TimerOutlined,
  Edit,
  Logout,
  Lock,
  Close,
} from "@mui/icons-material";
import { useState, useEffect } from "react";
import { format, differenceInSeconds } from "date-fns";

interface Student {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface Group {
  id: number;
  name: string;
  students: Student[];
}

interface Discipline {
  id: number;
  name: string;
  tests: number;
}

export default function TeacherDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(
    {}
  );
  const [newDisciplineOpen, setNewDisciplineOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [disciplineName, setDisciplineName] = useState("");
  const [isCreatingDiscipline, setIsCreatingDiscipline] = useState(false);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [newGroupList, setNewGroupList] = useState<string>("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // 1. Сохраняем текущее время в стейте
  const [now, setNow] = useState<Date | null>(null);

  // 2. Обновляем его каждую секунду только на клиенте
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Загрузка дисциплин с бэкенда
  useEffect(() => {
    if (tabValue !== 1) return;

    const fetchDisciplines = async () => {
      setIsLoadingDisciplines(true);
      try {
        const response = await fetch("/api/discipline/my");
        if (!response.ok) {
          throw new Error("Failed to fetch disciplines");
        }
        const data = await response.json();
        setDisciplines(data.subjects); // исправлено здесь
      } catch (error) {
        setSnackbar({
          open: true,
          message: "Ошибка при загрузке дисциплин",
          severity: "error",
        });
      } finally {
        setIsLoadingDisciplines(false);
      }
    };

    fetchDisciplines();
  }, [tabValue]);

  // Загрузка групп с бэкенда
  useEffect(() => {
    if (tabValue !== 2) return;

    const fetchGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const response = await fetch("/api/groups/my");
        if (!response.ok) {
          throw new Error("Failed to fetch groups");
        }
        const data = await response.json();

        // Преобразуем данные групп в нужный формат
        const transformedGroups = data.groups.map((group: Group) => ({
          ...group,
          students: group.students.map((student) => ({
            ...student,
            email: student.email || `${student.username}@bmstu.ru`,
          })),
        }));

        setGroups(transformedGroups);
      } catch (error) {
        console.error("Error fetching groups:", error);
        setSnackbar({
          open: true,
          message: "Ошибка при загрузке групп",
          severity: "error",
        });
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [tabValue]);

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
  ];

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const calculateTimeLeft = (dueDate: string) => {
    if (!now) return "";
    const due = new Date(dueDate);
    const seconds = Math.max(0, Math.floor((due.getTime() - now.getTime()) / 1000));
    return formatTime(seconds);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 60 / 60);
    const mins = Math.floor((seconds / 60) % 60);
    const secs = seconds % 60;

    const pad = (num: number) => (num < 10 ? `0${num}` : num);

    return `${hours > 0 ? pad(hours) + ":" : ""}${pad(mins)}:${pad(secs)}`;
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  const ruToEnMap: { [key: string]: string } = {
    А: "A",
    Б: "B",
    В: "V",
    Г: "G",
    Д: "D",
    Е: "E",
    Ё: "Yo",
    Ж: "Zh",
    З: "Z",
    И: "I",
    Й: "Y",
    К: "K",
    Л: "L",
    М: "M",
    Н: "N",
    О: "O",
    П: "P",
    Р: "R",
    С: "S",
    Т: "T",
    У: "U",
    Ф: "F",
    Х: "Kh",
    Ц: "Ts",
    Ч: "Ch",
    Ш: "Sh",
    Щ: "Shch",
    Ъ: "",
    Ы: "Y",
    Ь: "",
    Э: "E",
    Ю: "Yu",
    Я: "Ya",
  };

  function parseStudents(str: string) {
    const studentsArr = str
      .split("\n")
      .map((line) => line.split(" "))
      .map((arr) => arr.filter((item) => item !== ""));
    const students = studentsArr.map((arr) => {
      const nameArr = arr.slice(1, 4);
      const name = nameArr.reduce(
        (acc, cur) => (acc += ruToEnMap[cur[0]].toLowerCase()),
        ""
      );
      const username =
        name +
        arr[4].slice(0, 2) +
        ruToEnMap[arr[4][2]].toLowerCase() +
        arr[4].slice(3);
      return {
        first_name: nameArr[1],
        last_name: nameArr[0],
        username: username,
      };
    });
    return { group_name: studentsArr[0][5], students };
  }

  const handleCreateGroup = async () => {
    if (!newGroupList) {
      setSnackbar({
        open: true,
        message: "Вставьте данные студентов",
        severity: "error",
      });
      return;
    }

    setIsCreatingGroup(true);
    try {
      const students = parseStudents(newGroupList);

      const res = await fetch("/api/groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(students),
      });

      if (!res.ok) throw new Error("Ошибка при создании группы");

      const data = await res.json();
      console.log(data);

      setSnackbar({
        open: true,
        message: "Группа успешно создана",
        severity: "success",
      });
      setNewGroupOpen(false);
      setNewGroupList("");

      // Обновляем список групп после создания новой
      const groupsResponse = await fetch("/api/groups/my");
      if (groupsResponse.ok) {
        const updatedGroups = await groupsResponse.json();
        setGroups(
          updatedGroups.groups.map((group: Group) => ({
            ...group,
            students: group.students.map((student) => ({
              ...student,
              email: student.email || `${student.username}@bmstu.ru`,
            })),
          }))
        );
      }
    } catch (error) {
      console.error(error);
      setSnackbar({
        open: true,
        message: "Ошибка при создании группы. Попробуйте еще раз.",
        severity: "error",
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Обработка создания дисциплины
  const handleCreateDiscipline = async () => {
    if (!disciplineName.trim()) {
      setSnackbar({
        open: true,
        message: "Введите название дисциплины",
        severity: "error",
      });
      return;
    }
    setIsCreatingDiscipline(true);
    try {
      const res = await fetch("/api/discipline/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: disciplineName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка при создании дисциплины");
      }
      setSnackbar({
        open: true,
        message: "Дисциплина успешно создана",
        severity: "success",
      });
      setNewDisciplineOpen(false);
      setDisciplineName("");

      // Обновляем список дисциплин после создания новой
      const response = await fetch("/api/discipline/my");
      if (response.ok) {
        const data = await response.json();
        setDisciplines(data.subjects);
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || "Ошибка при создании дисциплины",
        severity: "error",
      });
    } finally {
      setIsCreatingDiscipline(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, display: "flex" }}>
      {/* Профиль пользователя */}
      <Box sx={{ position: "fixed", right: 32, top: 32, zIndex: 1000 }}>
        <Card
          variant="outlined"
          onClick={handleUserMenuOpen}
          sx={{ width: 200 }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Avatar sx={{ bgcolor: "primary.main", mr: 2 }}>
                <Person />
              </Avatar>
              <Typography variant="subtitle1">Иванов И.И.</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Преподаватель
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
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 4 }}>
          Панель преподавателя
        </Typography>

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ mb: 4 }}
        >
          <Tab label="Активные тесты" icon={<Quiz />} />
          <Tab label="Дисциплины" icon={<School />} />
          <Tab label="Группы" icon={<Groups />} />
        </Tabs>

        {tabValue === 0 && (
          <Grid container spacing={3}>
            <Grid sx={{ width: "100%" }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Текущие активные тесты
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 3 }}
                  >
                    {activeTests.map((test) => (
                      <Card
                        variant="outlined"
                        key={test.id}
                        sx={{ width: "100%" }}
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
                              label={
                                test.duration === 0
                                  ? "Без ограничения времени"
                                  : `Длительность: ${test.duration} мин`
                              }
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
                                now && differenceInSeconds(new Date(test.due), now) < 300
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
            </Grid>
          </Grid>
        )}

        {tabValue === 1 && (
          <Grid container spacing={3}>
            <Grid sx={{ width: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setNewDisciplineOpen(true)}
                >
                  Новая дисциплина
                </Button>
              </Box>
            </Grid>
            {isLoadingDisciplines ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  p: 4,
                }}
              >
                <CircularProgress />
              </Box>
            ) : ( disciplines ?
              disciplines.map((discipline) => (
                <Grid
                  sx={{ width: { xs: "100%", sm: "50%", md: "33.33%" } }}
                  key={discipline.id}
                >
                  <Card
                    variant="outlined"
                    sx={{ cursor: "pointer", "&:hover": { boxShadow: 2 } }}
                    onClick={() =>
                      console.log("Navigate to discipline", discipline.id)
                    }
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
              )) : <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      p: 6,
                      color: "text.secondary",
                      width: "100%",
                    }}
                  >
                    <School sx={{ fontSize: 56, mb: 2, color: "primary.main" }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      У вас пока нет дисциплин.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 3 }}>
                      Создайте новую дисциплину, чтобы начать работу с тестами и группами.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => setNewDisciplineOpen(true)}
                    >
                      Создать дисциплину
                    </Button>
                  </Box>
            )}
          </Grid>
        )}

        {tabValue === 2 && (
          <Grid container spacing={3}>
            <Grid sx={{ width: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setNewGroupOpen(true)}
                >
                  Новая группа
                </Button>
              </Box>
            </Grid>
            <Grid sx={{ width: "100%" }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    Все группы
                  </Typography>
                  {isLoadingGroups ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 4 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : groups.length === 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 4,
                        color: "text.secondary",
                      }}
                    >
                      <Groups sx={{ fontSize: 48, mb: 2 }} />
                      <Typography variant="body1">
                        У вас пока нет групп.
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                        Создайте новую группу, чтобы начать работу.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => setNewGroupOpen(true)}
                      >
                        Создать группу
                      </Button>
                    </Box>
                  ) : (
                    <List>
                      {groups.map((group) => (
                        <Paper key={group.id} variant="outlined" sx={{ mb: 2 }}>
                          <ListItemButton onClick={() => toggleGroup(group.id)}>
                            <Groups sx={{ mr: 2, color: "text.secondary" }} />
                            <ListItemText
                              primary={group.name}
                              secondary={`${group.students.length} студентов`}
                            />
                            <ExpandMore
                              sx={{
                                transform: expandedGroups[group.id]
                                  ? "rotate(180deg)"
                                  : "none",
                                transition: "transform 0.2s",
                              }}
                            />
                          </ListItemButton>
                          <Collapse in={expandedGroups[group.id]}>
                            <List dense disablePadding sx={{ pl: 4 }}>
                              {group.students.map((student) => (
                                <ListItem key={student.id} sx={{ pl: 3 }}>
                                  <ListItemAvatar>
                                    <Avatar>
                                      <Person />
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={`${student.last_name} ${student.first_name}`}
                                    secondary={student.email}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Collapse>
                        </Paper>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Попап создания дисциплины */}
      <Dialog
        open={newDisciplineOpen}
        onClose={() => setNewDisciplineOpen(false)}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>
          Новая дисциплина
          <IconButton
            onClick={() => setNewDisciplineOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ padding: '0 20px'}}>
          <TextField
            autoFocus
            margin="dense"
            label="Название дисциплины"
            fullWidth
            variant="outlined"
            value={disciplineName}
            onChange={(e) => setDisciplineName(e.target.value)}
            sx={{ mb: 2}}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDisciplineOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleCreateDiscipline}
            disabled={isCreatingDiscipline}
          >
            {isCreatingDiscipline ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Создание...
              </>
            ) : (
              "Создать"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Попап создания группы */}
      <Dialog
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Новая группа
          <IconButton
            onClick={() => setNewGroupOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Вставьте таблицу группы из eu.bmstu.ru
          </Typography>
          <TextField
            margin="dense"
            fullWidth
            variant="outlined"
            multiline
            rows={10}
            placeholder="Вставьте данные студентов здесь..."
            value={newGroupList}
            onChange={(e) => setNewGroupList(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewGroupOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleCreateGroup}
            disabled={isCreatingGroup}
          >
            {isCreatingGroup ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Создание...
              </>
            ) : (
              "Создать группу"
            )}
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
              /* Логика смены пароля */ setChangePasswordOpen(false);
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
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
