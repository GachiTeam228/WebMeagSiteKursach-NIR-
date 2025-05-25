"use client";

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
  ListItemAvatar,
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
} from "@mui/material";
import {
  ArrowBack,
  Folder,
  InsertDriveFile,
  CheckCircle,
  AccessTime,
  Timer,
  Warning,
  ExpandMore,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { format, differenceInHours, differenceInMinutes } from "date-fns";

type TestStatus = "not-assigned" | "completed" | "in-progress" | "overdue";

type Test = {
  id: number;
  name: string;
  status: TestStatus;
  score?: number;
  maxScore?: number;
  due?: string;
  completedAt?: string;
  type?: "test" | "homework" | "lab" | "exam";
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
      status: "completed" | "missed" | "in-progress";
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

export default function StudentDisciplinePage() {
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [expandedChapters, setExpandedChapters] = useState<
    Record<number, boolean>
  >({
    1: true,
    2: true,
    3: true,
  });

  // Mock data for discipline structure
  const [discipline, setDiscipline] = useState<DisciplineType>({
    id: 1,
    name: "Электромеханика",
    description: "Основы электромеханических систем и устройств",
    chapters: [
      {
        id: 1,
        title: "Основные понятия электромеханики",
        tests: [
          {
            id: 1,
            name: "Тест по базовым понятиям",
            status: "completed",
            score: 8,
            maxScore: 10,
            completedAt: "2023-05-15",
            type: "test",
            module: "Модуль 1",
          },
          {
            id: 2,
            name: "Контрольная работа №1",
            status: "in-progress",
            due: "2023-06-20T23:59:00",
            maxScore: 15,
            type: "test",
            module: "Модуль 1",
          },
          {
            id: 5,
            name: "Лабораторная работа №1",
            status: "completed",
            score: 12,
            maxScore: 15,
            completedAt: "2023-05-10",
            type: "lab",
            module: "Модуль 1",
          },
        ],
      },
      {
        id: 2,
        title: "Электрические машины",
        tests: [
          {
            id: 3,
            name: "Тест по трансформаторам",
            status: "not-assigned",
            maxScore: 10,
            type: "test",
            module: "Модуль 2",
          },
          {
            id: 4,
            name: "Домашнее задание №2",
            status: "overdue",
            due: "2023-05-10T23:59:00",
            maxScore: 20,
            type: "homework",
            module: "Модуль 2",
          },
        ],
      },
      {
        id: 3,
        title: "Экзаменационная подготовка",
        tests: [
          {
            id: 6,
            name: "Итоговый экзамен",
            status: "not-assigned",
            maxScore: 30,
            type: "exam",
            module: "Экзамен",
          },
        ],
      },
    ],
  });

  // Mock progress data for current student in this discipline
  const [progress, setProgress] = useState<StudentProgress>({
    studentId: 123,
    studentName: "Иванов Иван",
    disciplineId: 1,
    modules: [
      {
        name: "Модуль 1",
        items: [
          {
            id: 1,
            name: "Тест по базовым понятиям",
            type: "test",
            score: 8,
            maxScore: 10,
            date: "2023-05-15",
            status: "completed",
          },
          {
            id: 2,
            name: "Контрольная работа №1",
            type: "test",
            score: 0,
            maxScore: 15,
            date: "",
            status: "in-progress",
          },
          {
            id: 5,
            name: "Лабораторная работа №1",
            type: "lab",
            score: 12,
            maxScore: 15,
            date: "2023-05-10",
            status: "completed",
          },
        ],
        totalScore: 20, // 8 + 12 (контрольная еще не сдана)
        maxTotalScore: 40, // 10 + 15 + 15
      },
      {
        name: "Модуль 2",
        items: [
          {
            id: 3,
            name: "Тест по трансформаторам",
            type: "test",
            score: 0,
            maxScore: 10,
            date: "",
            status: "missed",
          },
          {
            id: 4,
            name: "Домашнее задание №2",
            type: "homework",
            score: 0,
            maxScore: 20,
            date: "",
            status: "missed",
          },
        ],
        totalScore: 0,
        maxTotalScore: 30, // 10 + 20
      },
    ],
    exam: {
      score: 0,
      maxScore: 30,
    },
    totalScore: 20, // 20 (Модуль 1) + 0 (Модуль 2) + 0 (Экзамен)
    maxTotalScore: 100, // 40 + 30 + 30
  });

  useEffect(() => {
    setDeadline(new Date());
  }, []);

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const calculateTimeLeft = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const hours = differenceInHours(due, now);
    const minutes = differenceInMinutes(due, now) % 60;
    return `${hours} ч ${minutes} мин`;
  };

  const getTestBadge = (test: Test) => {
    switch (test.status) {
      case "completed":
        return (
          <Chip
            label={`${test.score}/${test.maxScore}`}
            color="success"
            variant="outlined"
            icon={<CheckCircle fontSize="small" />}
          />
        );
      case "in-progress":
        return test.due ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label={`Срок: ${format(new Date(test.due), "dd.MM.yyyy HH:mm")}`}
              color="warning"
              variant="outlined"
            />
          </Box>
        ) : null;
      case "overdue":
        return test.due ? (
          <Chip
            label={`Просрочено: ${format(new Date(test.due), "dd.MM.yyyy")}`}
            color="error"
            variant="outlined"
          />
        ) : null;
      case "not-assigned":
      default:
        return <Chip label="Не выдано" color="default" variant="outlined" />;
    }
  };

  const getModuleProgress = (moduleName: string) => {
    const Module = progress.modules.find((m) => m.name === moduleName);
    if (!Module) return null;

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2">
          {Module.totalScore}/{Module.maxTotalScore}
        </Typography>
        <Box width="100px" bgcolor="#e0e0e0" borderRadius={1}>
          <Box
            width={`${(Module.totalScore / Module.maxTotalScore) * 100}%`}
            height={8}
            bgcolor={
              Module.totalScore / Module.maxTotalScore > 0.6
                ? "#4caf50"
                : "#ff9800"
            }
            borderRadius={1}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {discipline.name}
        </Typography>
      </Box>

      <Typography color="text.secondary" sx={{ mb: 4 }}>
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
            {discipline.chapters.map((chapter) => (
              <Paper key={chapter.id} elevation={2} sx={{ mb: 2 }}>
                <ListItemButton onClick={() => toggleChapter(chapter.id)}>
                  <Folder sx={{ mr: 2, color: "text.secondary" }} />
                  <ListItemText primary={chapter.title} sx={{ flexGrow: 1 }} />
                  <ExpandMore
                    sx={{
                      transform: expandedChapters[chapter.id]
                        ? "rotate(180deg)"
                        : "none",
                      transition: "transform 0.2s",
                    }}
                  />
                </ListItemButton>
                <Collapse in={expandedChapters[chapter.id]}>
                  <List dense disablePadding sx={{ pl: 4 }}>
                    {chapter.tests.map((test) => (
                      <ListItem
                        key={test.id}
                        secondaryAction={getTestBadge(test)}
                      >
                        <ListItemButton
                          onClick={() => router.push(`/tests/${test.id}`)}
                        >
                          <Avatar
                            sx={{
                              bgcolor: "background.default",
                              width: 24,
                              height: 24,
                              mr: 2,
                            }}
                          >
                            <InsertDriveFile color="primary" fontSize="small" />
                          </Avatar>
                          <ListItemText
                            primary={test.name}
                            secondary={test.module}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Paper>
            ))}
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Успеваемость по дисциплине
            </Typography>

            <Box sx={{ mb: 4, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Общий прогресс: {progress.totalScore} / {progress.maxTotalScore}{" "}
                баллов
              </Typography>
              <Box width="100%" bgcolor="#e0e0e0" borderRadius={1}>
                <Box
                  width={`${
                    (progress.totalScore / progress.maxTotalScore) * 100
                  }%`}
                  height={10}
                  bgcolor={
                    progress.totalScore / progress.maxTotalScore > 0.6
                      ? "#4caf50"
                      : "#ff9800"
                  }
                  borderRadius={1}
                />
              </Box>
            </Box>

            <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
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
                  {progress.modules.map((module) => (
                    <>
                      {module.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{module.name}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell align="right">{item.score}</TableCell>
                          <TableCell align="right">{item.maxScore}</TableCell>
                          <TableCell align="right">
                            {item.date
                              ? format(new Date(item.date), "dd.MM.yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {item.status === "completed" && (
                              <Chip
                                label="Завершено"
                                color="success"
                                size="small"
                              />
                            )}
                            {item.status === "in-progress" && (
                              <Chip
                                label="В процессе"
                                color="warning"
                                size="small"
                              />
                            )}
                            {item.status === "missed" && (
                              <Chip
                                label="Пропущено"
                                color="error"
                                size="small"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow
                        sx={{ "&:last-child td": { borderBottom: "none" } }}
                      >
                        <TableCell colSpan={2} sx={{ fontWeight: "bold" }}>
                          Итого по модулю
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold" }}>
                          {module.totalScore}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold" }}>
                          {module.maxTotalScore}
                        </TableCell>
                        <TableCell colSpan={2}>
                          <Box width="150px" bgcolor="#e0e0e0" borderRadius={1}>
                            <Box
                              width={`${
                                (module.totalScore / module.maxTotalScore) * 100
                              }%`}
                              height={8}
                              bgcolor={
                                module.totalScore / module.maxTotalScore > 0.6
                                  ? "#4caf50"
                                  : "#ff9800"
                              }
                              borderRadius={1}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0 }}>
                          <Divider />
                        </TableCell>
                      </TableRow>
                    </>
                  ))}

                  {progress.exam && (
                    <>
                      <TableRow>
                        <TableCell>Экзамен</TableCell>
                        <TableCell>Итоговый экзамен</TableCell>
                        <TableCell align="right">
                          {progress.exam.score}
                        </TableCell>
                        <TableCell align="right">
                          {progress.exam.maxScore}
                        </TableCell>
                        <TableCell align="right">-</TableCell>
                        <TableCell>
                          {progress.exam.score > 0 ? (
                            <Chip label="Сдан" color="success" size="small" />
                          ) : (
                            <Chip label="Не сдан" color="error" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={6} sx={{ p: 0 }}>
                          <Divider />
                        </TableCell>
                      </TableRow>
                    </>
                  )}

                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell colSpan={2} sx={{ fontWeight: "bold" }}>
                      Общий итог
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {progress.totalScore}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {progress.maxTotalScore}
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Box width="150px" bgcolor="#e0e0e0" borderRadius={1}>
                        <Box
                          width={`${
                            (progress.totalScore / progress.maxTotalScore) * 100
                          }%`}
                          height={8}
                          bgcolor={
                            progress.totalScore / progress.maxTotalScore > 0.6
                              ? "#4caf50"
                              : "#ff9800"
                          }
                          borderRadius={1}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
function setDeadline(arg0: Date) {
  throw new Error("Function not implemented.");
}

