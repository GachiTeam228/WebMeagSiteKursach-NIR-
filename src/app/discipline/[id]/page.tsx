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
  InputAdornment,
  styled,
  alpha,
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
} from "@mui/icons-material";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// Типы для строгой типизации
type Test = {
  id: number;
  name: string;
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
};

type Student = {
  id: number;
  name: string;
  email: string;
};

type DisciplineType = {
  id: number;
  name: string;
  description: string;
  groups: Group[];
  chapters: Chapter[];
};

type EditingItem = {
  type: "chapter" | "test";
  id: number;
} | null;

const DisabledTab = styled(Tab)(({ theme }) => ({
  "&.Mui-disabled": {
    color: alpha(theme.palette.text.primary, 0.5),
  },
}));

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
  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isTeacher, setIsTeacher] = useState(true);

  // Mock data
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

  useEffect(() => {
    if (editingItem && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingItem]);

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

      const chapter = { ...discipline.chapters[chapterIndex] };
      const items = [...chapter.tests];
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
      title: "Новый раздел",
      tests: [],
    };
    setDiscipline({
      ...discipline,
      chapters: [...discipline.chapters, newChapter],
    });
    setExpandedChapters((prev) => ({ ...prev, [newChapter.id]: true }));
    setEditingItem({ type: "chapter", id: newChapter.id });
  };

  const addTest = (chapterId: number) => {
    const chapterIndex = discipline.chapters.findIndex(
      (c) => c.id === chapterId
    );
    if (chapterIndex === -1) return;

    const testIds = discipline.chapters
      .flatMap((c) => c.tests)
      .map((t) => t.id);
    const newTestId = testIds.length > 0 ? Math.max(...testIds) + 1 : 1;

    const newTest: Test = {
      id: newTestId,
      name: "Новый тест",
    };

    const newChapters = [...discipline.chapters];
    newChapters[chapterIndex].tests.push(newTest);

    setDiscipline({ ...discipline, chapters: newChapters });
    setEditingItem({ type: "test", id: newTestId });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (editingItem?.type === "chapter") {
      setDiscipline({
        ...discipline,
        chapters: discipline.chapters.map((chapter) =>
          chapter.id === editingItem.id
            ? { ...chapter, title: newName }
            : chapter
        ),
      });
    } else if (editingItem?.type === "test") {
      setDiscipline({
        ...discipline,
        chapters: discipline.chapters.map((chapter) => ({
          ...chapter,
          tests: chapter.tests.map((test) =>
            test.id === editingItem.id ? { ...test, name: newName } : test
          ),
        })),
      });
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditingItem(null);
  };

  const getCurrentName = () => {
    if (!editingItem) return "";
    if (editingItem.type === "chapter") {
      const chapter = discipline.chapters.find((c) => c.id === editingItem.id);
      return chapter ? chapter.title : "";
    } else {
      for (const chapter of discipline.chapters) {
        const test = chapter.tests.find((t) => t.id === editingItem.id);
        if (test) return test.name;
      }
      return "";
    }
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
        <Box sx={{ flexGrow: 1 }} />
        {isTeacher &&
          tabValue === 0 &&
          (editMode ? (
            <Stack direction="row" spacing={2}>
              <Button startIcon={<Close />} onClick={() => setEditMode(false)}>
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
            <Button startIcon={<Edit />} onClick={() => setEditMode(true)}>
              Редактировать
            </Button>
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
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="chapters" type="CHAPTERS">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {discipline.chapters.map((chapter, chapterIndex) => (
                      <Draggable
                        key={chapter.id}
                        draggableId={`chapter-${chapter.id}`}
                        index={chapterIndex}
                        isDragDisabled={!editMode}
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
                              {editMode && (
                                <div {...provided.dragHandleProps}>
                                  <DragHandle sx={{ mr: 2 }} />
                                </div>
                              )}
                              <Folder sx={{ mr: 2, color: "text.secondary" }} />
                              {editingItem?.type === "chapter" &&
                              editingItem.id === chapter.id ? (
                                <form
                                  onSubmit={handleNameSubmit}
                                  style={{ flexGrow: 1 }}
                                >
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    value={getCurrentName()}
                                    onChange={handleNameChange}
                                    onBlur={handleNameSubmit}
                                    inputRef={inputRef}
                                  />
                                </form>
                              ) : (
                                <ListItemText
                                  primary={chapter.title}
                                  onClick={() =>
                                    editMode &&
                                    setEditingItem({
                                      type: "chapter",
                                      id: chapter.id,
                                    })
                                  }
                                  sx={{ flexGrow: 1 }}
                                />
                              )}
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
                              <Droppable
                                droppableId={chapter.id.toString()}
                                type="TESTS"
                              >
                                {(provided) => (
                                  <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    style={{
                                      paddingLeft: editMode ? "40px" : "32px",
                                    }}
                                  >
                                    <List dense disablePadding>
                                      {chapter.tests.map((test, testIndex) => (
                                        <Draggable
                                          key={test.id}
                                          draggableId={`test-${test.id}`}
                                          index={testIndex}
                                          isDragDisabled={!editMode}
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
                                              <ListItemButton
                                                onClick={() =>
                                                  !editMode &&
                                                  router.push(
                                                    `/tests/${test.id}`
                                                  )
                                                }
                                              >
                                                {editMode && (
                                                  <div
                                                    {...provided.dragHandleProps}
                                                  >
                                                    <DragHandle
                                                      sx={{ mr: 2 }}
                                                    />
                                                  </div>
                                                )}
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
                                                {editingItem?.type === "test" &&
                                                editingItem?.id === test.id ? (
                                                  <form
                                                    onSubmit={handleNameSubmit}
                                                    style={{ flexGrow: 1 }}
                                                  >
                                                    <TextField
                                                      fullWidth
                                                      variant="standard"
                                                      value={getCurrentName()}
                                                      onChange={
                                                        handleNameChange
                                                      }
                                                      onBlur={handleNameSubmit}
                                                      inputRef={inputRef}
                                                    />
                                                  </form>
                                                ) : (
                                                  <ListItemText
                                                    primary={test.name}
                                                    onClick={(e) => {
                                                      if (editMode) {
                                                        e.stopPropagation();
                                                        setEditingItem({
                                                          type: "test",
                                                          id: test.id,
                                                        });
                                                      }
                                                    }}
                                                    sx={{ flexGrow: 1 }}
                                                  />
                                                )}
                                              </ListItemButton>
                                            </Paper>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </List>
                                  </div>
                                )}
                              </Droppable>
                              {editMode && (
                                <Box sx={{ pl: 4, pb: 1 }}>
                                  <Button
                                    size="small"
                                    startIcon={<Add />}
                                    onClick={() => addTest(chapter.id)}
                                  >
                                    Новый тест
                                  </Button>
                                </Box>
                              )}
                            </Collapse>
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            {editMode && (
              <Box sx={{ p: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={addChapter}
                >
                  Добавить раздел
                </Button>
              </Box>
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
    </Container>
  );
}
