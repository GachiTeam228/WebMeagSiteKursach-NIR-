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
import { useState } from "react";
import { format, differenceInSeconds } from "date-fns";

export default function TeacherDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(
    {}
  );
  const [newDisciplineOpen, setNewDisciplineOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [disciplineName, setDisciplineName] = useState("");
  const [disciplineDescription, setDisciplineDescription] = useState("");
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );

  // Данные (аналогично вашему коду)
  const disciplines = [
    {
      id: 1,
      name: "Алгоритмы и структуры данных",
      groups: [
        {
          id: 1,
          name: "CS-201",
          students: [
            { id: 1, name: "Иванов Иван", email: "ivanov@bmstu.ru" },
            { id: 2, name: "Петров Петр", email: "petrov@bmstu.ru" },
          ],
        },
        {
          id: 2,
          name: "CS-202",
          students: [
            { id: 3, name: "Сидоров Сидор", email: "sidorov@bmstu.ru" },
          ],
        },
      ],
      tests: 5,
    },
    // ... остальные дисциплины
  ];

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
    // ... остальные тесты
  ];

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

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

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, display: "flex" }}>
      {/* Профиль пользователя (правый верхний угол) */}
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
                                calculateTimeLeft(test.due) < 300
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
            {disciplines.map((discipline) => (
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
                        label={`${discipline.groups.length} групп`}
                        variant="outlined"
                        size="small"
                      />
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
                    Группы на курсе
                  </Typography>
                  <List>
                    {disciplines.map((discipline) => (
                      <Box key={discipline.id} sx={{ mb: 3 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{ mb: 2, color: "text.secondary" }}
                        >
                          {discipline.name}
                        </Typography>
                        {discipline.groups.map((group) => (
                          <Paper
                            key={group.id}
                            variant="outlined"
                            sx={{ mb: 2 }}
                          >
                            <ListItemButton
                              onClick={() => toggleGroup(group.id)}
                            >
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
                                      primary={student.name}
                                      secondary={student.email}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Collapse>
                          </Paper>
                        ))}
                      </Box>
                    ))}
                  </List>
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
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название дисциплины"
            fullWidth
            variant="outlined"
            value={disciplineName}
            onChange={(e) => setDisciplineName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Описание (необязательно)"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={disciplineDescription}
            onChange={(e) => setDisciplineDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDisciplineOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={() => {
              /* Логика создания */ setNewDisciplineOpen(false);
            }}
          >
            Создать
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewGroupOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={() => {
              /* Логика создания */ setNewGroupOpen(false);
            }}
          >
            Создать группу
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
    </Container>
  );
}
