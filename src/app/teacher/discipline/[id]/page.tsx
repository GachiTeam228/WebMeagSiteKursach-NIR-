"use client";

import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  IconButton,
  Collapse,
  Paper,
  Stack,
  Avatar,
  ListItemAvatar,
  ListItemButton,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from "@mui/material";
import {
  Add,
  Groups,
  ArrowBack,
  Edit,
  Close,
  Check,
  ExpandMore,
  ExpandLess,
  Folder,
  InsertDriveFile,
  DragHandle,
  Person,
  Timer,
  AccessTime,
  Quiz,
} from "@mui/icons-material";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { MobileDateTimePicker } from "@mui/x-date-pickers/MobileDateTimePicker";
import { ru } from "date-fns/locale";

type Test = {
  id: number;
  name: string;
  selected?: boolean;
};

type Chapter = {
  id: number;
  title: string;
  tests: Test[];
};

type Group = {
  id: number;
  name: string;
  students: Student[];
  selected?: boolean;
  indeterminate?: boolean;
};

type Student = {
  id: number;
  name: string;
  email: string;
  selected?: boolean;
};

type DisciplineType = {
  id: number;
  name: string;
  description: string;
  groups: Group[];
  chapters: Chapter[];
};

export default function DisciplinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<
    Record<number, boolean>
  >({
    1: true,
    2: true,
    3: true,
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>(
    {}
  );
  const [assignTestsOpen, setAssignTestsOpen] = useState(false);
  const [deadline, setDeadline] = useState<Date | null>(new Date());
  const [selectedTests, setSelectedTests] = useState<Test[]>([]);
  const [isTeacher, setIsTeacher] = useState(true);

  const [discipline, setDiscipline] = useState<DisciplineType>({
    id: 1,
    name: "Электромеханика",
    description: "Основы электромеханических систем и устройств",
    groups: [
      {
        id: 1,
        name: "EM-201",
        students: [
          { id: 1, name: "Иванов Иван", email: "ivanov@example.com" },
          { id: 2, name: "Петров Петр", email: "petrov@example.com" },
        ],
      },
      {
        id: 2,
        name: "EM-202",
        students: [
          { id: 3, name: "Сидорова Мария", email: "sidorova@example.com" },
        ],
      },
    ],
    chapters: [
      {
        id: 1,
        title: "Основные понятия электромеханики",
        tests: [
          { id: 1, name: "Тест по базовым понятиям" },
          { id: 2, name: "Контрольная работа №1" },
        ],
      },
      {
        id: 2,
        title: "Электрические машины",
        tests: [
          { id: 3, name: "Тест по трансформаторам" },
          { id: 4, name: "Лабораторная работа" },
        ],
      },
      {
        id: 3,
        title: "Автоматизированные системы",
        tests: [],
      },
    ],
  });

  // Функции для редактирования структуры курса
  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    if (result.type === "CHAPTERS") {
      const items = Array.from(discipline.chapters);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setDiscipline({ ...discipline, chapters: items });
    } else if (result.type === "TESTS") {
      const chapterIndex = discipline.chapters.findIndex(
        (ch) => ch.id.toString() === result.destination.droppableId
      );
      if (chapterIndex === -1) return;

      const chapter = discipline.chapters[chapterIndex];
      const items = Array.from(chapter.tests);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      const newChapters = [...discipline.chapters];
      newChapters[chapterIndex].tests = items;
      setDiscipline({ ...discipline, chapters: newChapters });
    }
  };

  const addChapter = () => {
    const newChapter = {
      id: Math.max(...discipline.chapters.map((c) => c.id)) + 1,
      title: `Глава ${discipline.chapters.length + 1}: Новая глава`,
      tests: [],
    };
    setDiscipline({
      ...discipline,
      chapters: [...discipline.chapters, newChapter],
    });
    setExpandedChapters((prev) => ({ ...prev, [newChapter.id]: true }));
  };

  const addTest = (chapterId: number) => {
    const chapterIndex = discipline.chapters.findIndex(
      (c) => c.id === chapterId
    );
    if (chapterIndex === -1) return;

    const newTest = {
      id:
        Math.max(
          ...discipline.chapters.flatMap((c) => c.tests).map((t) => t.id)
        ) + 1,
      name: "Новый тест",
    };

    const newChapters = [...discipline.chapters];
    newChapters[chapterIndex].tests.push(newTest);
    setDiscipline({ ...discipline, chapters: newChapters });
  };

  // Функции для выдачи тестов
  const handleTestSelect = (testId: number, checked: boolean) => {
    const updatedChapters = discipline.chapters.map((chapter) => ({
      ...chapter,
      tests: chapter.tests.map((test) =>
        test.id === testId ? { ...test, selected: checked } : test
      ),
    }));

    setDiscipline({ ...discipline, chapters: updatedChapters });

    if (checked) {
      const testToAdd = updatedChapters
        .flatMap((ch) => ch.tests)
        .find((t) => t.id === testId);
      if (testToAdd) {
        setSelectedTests((prev) => [...prev, testToAdd]);
      }
    } else {
      setSelectedTests((prev) => prev.filter((t) => t.id !== testId));
    }
  };

  const handleGroupSelect = (groupId: number, checked: boolean) => {
    const updatedGroups = discipline.groups.map((group) => {
      if (group.id === groupId) {
        const updatedStudents = group.students.map((student) => ({
          ...student,
          selected: checked,
        }));
        return {
          ...group,
          selected: checked,
          indeterminate: false,
          students: updatedStudents,
        };
      }
      return group;
    });

    setDiscipline({ ...discipline, groups: updatedGroups });
  };

  const handleStudentSelect = (
    groupId: number,
    studentId: number,
    checked: boolean
  ) => {
    const updatedGroups = discipline.groups.map((group) => {
      if (group.id === groupId) {
        const updatedStudents = group.students.map((student) =>
          student.id === studentId ? { ...student, selected: checked } : student
        );

        const allSelected = updatedStudents.every((s) => s.selected);
        const someSelected =
          updatedStudents.some((s) => s.selected) && !allSelected;

        return {
          ...group,
          selected: allSelected,
          indeterminate: someSelected,
          students: updatedStudents,
        };
      }
      return group;
    });

    setDiscipline({ ...discipline, groups: updatedGroups });
  };

  const calculateTimeLeft = (dueDate: Date) => {
    const now = new Date();
    const hours = differenceInHours(dueDate, now);
    const minutes = differenceInMinutes(dueDate, now) % 60;
    return `${hours} ч ${minutes} мин`;
  };

  const handleAssignTests = () => {
    console.log("Выдаем тесты:", {
      tests: selectedTests,
      deadline,
      selectedGroups: discipline.groups.filter((g) => g.selected),
      selectedStudents: discipline.groups.flatMap((g) =>
        g.students
          .filter((s) => s.selected)
          .map((s) => ({ ...s, groupId: g.id }))
      ),
    });
    setAssignTestsOpen(false);
    setSelectedTests([]);
  };

  const toggleChapter = (chapterId: number) => {
    if (editMode) return;
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
          <IconButton onClick={() => router.back()} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {discipline.name}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {isTeacher &&
            tabValue === 0 &&
            (editMode ? (
              <Stack direction="row" spacing={2}>
                <Button
                  startIcon={<Close />}
                  onClick={() => setEditMode(false)}
                >
                  Отменить
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Check />}
                  onClick={() => setEditMode(false)}
                >
                  Сохранить
                </Button>
              </Stack>
            ) : (
              <>
                <Button
                  startIcon={<Edit />}
                  onClick={() => setEditMode(true)}
                  sx={{ mr: 2 }}
                >
                  Редактировать
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Quiz />}
                  onClick={() => setAssignTestsOpen(true)}
                  disabled={selectedTests.length === 0}
                >
                  Выдать тесты
                </Button>
              </>
            ))}
        </Box>

        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {discipline.description}
        </Typography>

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => !editMode && setTabValue(newValue)}
          sx={{ mb: 4 }}
        >
          <Tab label="Структура курса" disabled={editMode} />
          <Tab label="Группы" disabled={editMode} />
          {isTeacher && <Tab label="Настройки" disabled={editMode} />}
        </Tabs>

        {tabValue === 0 && (
          <Card elevation={3}>
            <CardContent>
              {editMode ? (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="chapters" type="CHAPTERS">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {discipline.chapters.map((chapter, chapterIndex) => (
                          <Draggable
                            key={chapter.id}
                            draggableId={`chapter-${chapter.id}`}
                            index={chapterIndex}
                          >
                            {(provided) => (
                              <Paper
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                elevation={2}
                                sx={{ mb: 2 }}
                              >
                                <ListItemButton
                                  onClick={() => toggleChapter(chapter.id)}
                                  sx={{
                                    p: 2,
                                    bgcolor: "background.paper",
                                    borderBottom: "1px solid",
                                    borderColor: "divider",
                                  }}
                                >
                                  <div {...provided.dragHandleProps}>
                                    <DragHandle sx={{ mr: 2 }} />
                                  </div>
                                  <Folder
                                    sx={{ mr: 2, color: "text.secondary" }}
                                  />
                                  <ListItemText primary={chapter.title} />
                                  {expandedChapters[chapter.id] ? (
                                    <ExpandLess />
                                  ) : (
                                    <ExpandMore />
                                  )}
                                </ListItemButton>

                                <Collapse in={expandedChapters[chapter.id]}>
                                  <Droppable
                                    droppableId={chapter.id.toString()}
                                    type="TESTS"
                                  >
                                    {(provided) => (
                                      <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        style={{ paddingLeft: "40px" }}
                                      >
                                        <List dense disablePadding>
                                          {chapter.tests.map(
                                            (test, testIndex) => (
                                              <Draggable
                                                key={test.id}
                                                draggableId={`test-${test.id}`}
                                                index={testIndex}
                                              >
                                                {(provided) => (
                                                  <Paper
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    elevation={0}
                                                    sx={{
                                                      borderLeft: "2px solid",
                                                      borderColor: "divider",
                                                      mb: 0.5,
                                                    }}
                                                  >
                                                    <ListItemButton>
                                                      <div
                                                        {...provided.dragHandleProps}
                                                      >
                                                        <DragHandle
                                                          sx={{ mr: 2 }}
                                                        />
                                                      </div>
                                                      <Avatar
                                                        sx={{
                                                          bgcolor:
                                                            "background.default",
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
                                                      <ListItemText
                                                        primary={test.name}
                                                      />
                                                    </ListItemButton>
                                                  </Paper>
                                                )}
                                              </Draggable>
                                            )
                                          )}
                                          {provided.placeholder}
                                        </List>
                                      </div>
                                    )}
                                  </Droppable>

                                  <Box sx={{ pl: 4, pb: 1 }}>
                                    <Button
                                      size="small"
                                      startIcon={<Add />}
                                      onClick={() => addTest(chapter.id)}
                                    >
                                      Новый тест
                                    </Button>
                                  </Box>
                                </Collapse>
                              </Paper>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  <Box sx={{ p: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={addChapter}
                    >
                      Добавить главу
                    </Button>
                  </Box>
                </DragDropContext>
              ) : (
                <>
                  {discipline.chapters.map((chapter) => (
                    <Paper key={chapter.id} elevation={2} sx={{ mb: 2 }}>
                      <ListItemButton onClick={() => toggleChapter(chapter.id)}>
                        <Folder sx={{ mr: 2, color: "text.secondary" }} />
                        <ListItemText primary={chapter.title} />
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
                              secondaryAction={
                                isTeacher && (
                                  <Checkbox
                                    edge="end"
                                    checked={test.selected || false}
                                    onChange={(e) =>
                                      handleTestSelect(
                                        test.id,
                                        e.target.checked
                                      )
                                    }
                                  />
                                )
                              }
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
                                  <InsertDriveFile
                                    color="primary"
                                    fontSize="small"
                                  />
                                </Avatar>
                                <ListItemText primary={test.name} />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      </Collapse>
                    </Paper>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {tabValue === 1 && (
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Группы на курсе
              </Typography>
              <List>
                {discipline.groups.map((group) => (
                  <Paper key={group.id} elevation={2} sx={{ mb: 2 }}>
                    <ListItemButton onClick={() => toggleGroup(group.id)}>
                      {isTeacher && (
                        <Checkbox
                          edge="start"
                          checked={group.selected || false}
                          indeterminate={group.indeterminate}
                          onChange={(e) =>
                            handleGroupSelect(group.id, e.target.checked)
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
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
                          <ListItem
                            key={student.id}
                            secondaryAction={
                              isTeacher && (
                                <Checkbox
                                  edge="end"
                                  checked={student.selected || false}
                                  onChange={(e) =>
                                    handleStudentSelect(
                                      group.id,
                                      student.id,
                                      e.target.checked
                                    )
                                  }
                                />
                              )
                            }
                          >
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
              </List>
            </CardContent>
          </Card>
        )}

        {tabValue === 2 && isTeacher && (
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Настройки дисциплины
              </Typography>
              <TextField
                label="Название дисциплины"
                fullWidth
                defaultValue={discipline.name}
                sx={{ mb: 3 }}
              />
              <TextField
                label="Описание"
                multiline
                rows={4}
                fullWidth
                defaultValue={discipline.description}
                sx={{ mb: 3 }}
              />
              <Button variant="contained">Сохранить изменения</Button>
            </CardContent>
          </Card>
        )}

        {/* Диалог выдачи тестов */}
        <Dialog
          open={assignTestsOpen}
          onClose={() => setAssignTestsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Выдать тесты
            <IconButton
              onClick={() => setAssignTestsOpen(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Выбранные тесты:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {selectedTests.map((test) => (
                  <Chip
                    key={test.id}
                    label={test.name}
                    onDelete={() => handleTestSelect(test.id, false)}
                  />
                ))}
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Установите срок сдачи:
              </Typography>
              <MobileDateTimePicker
                value={deadline}
                onChange={(newValue) => setDeadline(newValue)}
                label="Срок сдачи"
                minDateTime={new Date()}
                format="dd.MM.yyyy HH:mm"
              />
              {deadline && (
                <Box sx={{ mt: 2, display: "flex", alignItems: "center" }}>
                  <Timer fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    Осталось: {calculateTimeLeft(deadline)}
                  </Typography>
                </Box>
              )}
            </Box>

            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Выберите группы и студентов:
            </Typography>
            <List>
              {discipline.groups.map((group) => (
                <Paper key={group.id} elevation={2} sx={{ mb: 2 }}>
                  <ListItemButton onClick={() => toggleGroup(group.id)}>
                    <Checkbox
                      edge="start"
                      checked={group.selected || false}
                      indeterminate={group.indeterminate}
                      onChange={(e) =>
                        handleGroupSelect(group.id, e.target.checked)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
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
                        <ListItem
                          key={student.id}
                          secondaryAction={
                            <Checkbox
                              edge="end"
                              checked={student.selected || false}
                              onChange={(e) =>
                                handleStudentSelect(
                                  group.id,
                                  student.id,
                                  e.target.checked
                                )
                              }
                            />
                          }
                        >
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
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignTestsOpen(false)}>Отмена</Button>
            <Button
              variant="contained"
              onClick={handleAssignTests}
              disabled={
                !deadline ||
                !discipline.groups.some(
                  (g) => g.selected || g.students.some((s) => s.selected)
                )
              }
            >
              Выдать тесты
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
}
