'use client';

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
  CircularProgress,
} from '@mui/material';
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
  Quiz,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use, Usable } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { differenceInHours, differenceInMinutes } from 'date-fns';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { MobileDateTimePicker } from '@mui/x-date-pickers/MobileDateTimePicker';
import { ru } from 'date-fns/locale';

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

export default function DisciplinePage({ params }: { params: Usable<{ id: string }> }) {
  const router = useRouter();
  const { id } = use<{ id: string }>(params);
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
  const [assignTestsOpen, setAssignTestsOpen] = useState(false);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [selectedTests, setSelectedTests] = useState<Test[]>([]);
  const isTeacher = true;
  const [addGroupDialogOpen, setAddGroupDialogOpen] = useState(false);
  const [allTeacherGroups, setAllTeacherGroups] = useState<Group[]>([]);
  const [groupsToAdd, setGroupsToAdd] = useState<number[]>([]);

  const [discipline, setDiscipline] = useState<DisciplineType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const fetchDisciplines = async () => {
      try {
        const response = await fetch(`/api/discipline/${id}/get`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data: DisciplineType = await response.json();
        setDiscipline(data);
      } catch {
        setDiscipline(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDisciplines();
  }, [id]);

  useEffect(() => {
    if (deadline === null) setDeadline(new Date());
  }, [deadline]);

  const onDragEnd = (result: any) => {
    if (!result.destination || !discipline) return;
    if (result.type === 'CHAPTERS') {
      const items = Array.from(discipline.chapters);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setDiscipline({ ...discipline, chapters: items });
    } else if (result.type === 'TESTS') {
      const chapterIndex = discipline.chapters.findIndex((ch) => ch.id.toString() === result.destination.droppableId);
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
    if (!discipline) return;
    const newId = -Date.now(); // Временный отрицательный ID для новой главы
    const newChapter = {
      id: newId,
      title: `Глава ${discipline.chapters.length + 1}: Новая глава`,
      tests: [],
    };
    setDiscipline({ ...discipline, chapters: [...(discipline.chapters || []), newChapter] });
    setExpandedChapters((prev) => ({ ...prev, [newId]: true }));
  };

  const addTest = (chapterId: number) => {
    if (!discipline) return;
    const chapterIndex = discipline.chapters.findIndex((c) => c.id === chapterId);
    if (chapterIndex === -1) return;
    const newId = -Date.now(); // Временный отрицательный ID для нового теста
    const newTest = { id: newId, name: 'Новый тест' };
    const newChapters = [...discipline.chapters];
    newChapters[chapterIndex].tests.push(newTest);
    setDiscipline({ ...discipline, chapters: newChapters });
  };

  // --- НОВАЯ ФУНКЦИЯ ---
  const handleNameChange = (type: 'chapter' | 'test', chapterId: number, newName: string, testId?: number) => {
    if (!discipline) return;
    const newChapters = discipline.chapters.map((ch) => {
      if (type === 'chapter' && ch.id === chapterId) {
        return { ...ch, title: newName };
      }
      if (type === 'test' && ch.id === chapterId) {
        const newTests = ch.tests.map((t) => (t.id === testId ? { ...t, name: newName } : t));
        return { ...ch, tests: newTests };
      }
      return ch;
    });
    setDiscipline({ ...discipline, chapters: newChapters });
  };

  const handleTestSelect = (testId: number, checked: boolean) => {
    if (!discipline) return;
    const updatedChapters = discipline.chapters.map((chapter) => ({
      ...chapter,
      tests: chapter.tests.map((test) => (test.id === testId ? { ...test, selected: checked } : test)),
    }));
    setDiscipline({ ...discipline, chapters: updatedChapters });
    if (checked) {
      const testToAdd = updatedChapters.flatMap((ch) => ch.tests).find((t) => t.id === testId);
      if (testToAdd) setSelectedTests((prev) => [...prev, testToAdd]);
    } else {
      setSelectedTests((prev) => prev.filter((t) => t.id !== testId));
    }
  };

  const handleGroupSelect = (groupId: number, checked: boolean) => {
    if (!discipline) return;
    const updatedGroups = discipline.groups.map((group) => {
      if (group.id === groupId) {
        const updatedStudents = group.students.map((student) => ({ ...student, selected: checked }));
        return { ...group, selected: checked, indeterminate: false, students: updatedStudents };
      }
      return group;
    });
    setDiscipline({ ...discipline, groups: updatedGroups });
  };

  const handleStudentSelect = (groupId: number, studentId: number, checked: boolean) => {
    if (!discipline) return;
    const updatedGroups = discipline.groups.map((group) => {
      if (group.id === groupId) {
        const updatedStudents = group.students.map((student) =>
          student.id === studentId ? { ...student, selected: checked } : student
        );
        const allSelected = updatedStudents.every((s) => s.selected);
        const someSelected = updatedStudents.some((s) => s.selected) && !allSelected;
        return { ...group, selected: allSelected, indeterminate: someSelected, students: updatedStudents };
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

  const handleAssignTests = async () => {
    if (!discipline || !deadline) return;

    try {
      // Собираем выбранные группы (целиком)
      const selectedGroups = discipline.groups.filter((g) => g.selected);

      // Собираем отдельных студентов (не входящих в выбранные группы целиком)
      const selectedStudents = discipline.groups
        .filter((g) => !g.selected) // Исключаем группы, выбранные целиком
        .flatMap((g) => g.students.filter((s) => s.selected).map((s) => s.id));

      // Выдаем каждый тест
      for (const test of selectedTests) {
        try {
          // Выдаем группам целиком
          for (const group of selectedGroups) {
            const response = await fetch(`/api/assign-test/group/${group.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                test_id: test.id,
                deadline: deadline.toISOString(),
              }),
            });

            if (!response.ok) {
              const data = await response.json();
              console.error(`Failed to assign test ${test.name} to group ${group.name}:`, data.error);
            }
          }

          // Выдаем отдельным студентам
          if (selectedStudents.length > 0) {
            if (selectedStudents.length === 1) {
              // Один студент - используем endpoint для одного
              const response = await fetch(`/api/assign-test/student/${selectedStudents[0]}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  test_id: test.id,
                  deadline: deadline.toISOString(),
                }),
              });

              if (!response.ok) {
                const data = await response.json();
                console.error(`Failed to assign test ${test.name} to student ${selectedStudents[0]}:`, data.error);
              }
            } else {
              // Несколько студентов - используем endpoint для множественной выдачи
              const response = await fetch('/api/assign-test/student/multiple', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  test_id: test.id,
                  student_ids: selectedStudents,
                  deadline: deadline.toISOString(),
                }),
              });

              if (!response.ok) {
                const data = await response.json();
                console.error(`Failed to assign test ${test.name} to multiple students:`, data.error);
              }
            }
          }
        } catch (error) {
          console.error(`Error assigning test ${test.name}:`, error);
        }
      }
      // Закрываем диалог и сбрасываем состояние
      setAssignTestsOpen(false);
      setSelectedTests([]);

      // Снимаем выделение с групп и студентов
      const resetGroups = discipline.groups.map((group) => ({
        ...group,
        selected: false,
        indeterminate: false,
        students: group.students.map((student) => ({ ...student, selected: false })),
      }));
      setDiscipline({ ...discipline, groups: resetGroups });

      // Снимаем выделение с тестов
      const resetChapters = discipline.chapters.map((chapter) => ({
        ...chapter,
        tests: chapter.tests.map((test) => ({ ...test, selected: false })),
      }));
      setDiscipline({ ...discipline, chapters: resetChapters });
    } catch (error) {
      console.error('Error assigning tests:', error);
      alert('Произошла критическая ошибка при выдаче тестов');
    }
  };

  const toggleChapter = (chapterId: number) => {
    // if (editMode) return;
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleSaveStructure = async () => {
    if (!discipline) return;
    // --- ОБНОВЛЕННАЯ СТРУКТУРА ДЛЯ API ---
    const chapters = discipline.chapters.map((chapter, chapterIdx) => ({
      id: chapter.id,
      title: chapter.title, // Отправляем название
      order: chapterIdx,
      tests: chapter.tests.map((test, testIdx) => ({
        id: test.id,
        name: test.name, // Отправляем название
        order: testIdx,
      })),
    }));

    try {
      const res = await fetch(`/api/discipline/${discipline.id}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения структуры');
      setEditMode(false);
    } catch {
      alert('Ошибка при сохранении структуры');
    }
  };

  // Функция для открытия диалога и загрузки всех групп преподавателя
  const handleOpenAddGroupDialog = async () => {
    try {
      const response = await fetch('/api/groups/my');
      if (!response.ok) throw new Error('Failed to fetch teacher groups');
      const data = await response.json();
      // Убедимся, что data.groups это массив
      if (Array.isArray(data.groups)) {
        setAllTeacherGroups(data.groups);
      } else {
        setAllTeacherGroups([]);
      }
    } catch (error) {
      console.error(error);
      setAllTeacherGroups([]);
    }
    setAddGroupDialogOpen(true);
  };

  // Функция для выбора группы в диалоге
  const handleToggleGroupToAdd = (groupId: number) => {
    setGroupsToAdd((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  };

  // Функция для отправки выбранных групп на сервер
  const handleConfirmAddGroups = async () => {
    if (groupsToAdd.length === 0) return;
    try {
      const res = await fetch(`/api/discipline/${id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: groupsToAdd }),
      });
      if (!res.ok) throw new Error('Failed to add groups');

      // Обновляем UI: добавляем новые группы в состояние
      const addedGroups = allTeacherGroups.filter((g) => groupsToAdd.includes(g.id));
      setDiscipline((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          groups: [...prev.groups, ...addedGroups],
        };
      });

      setAddGroupDialogOpen(false);
      setGroupsToAdd([]);
    } catch (error) {
      console.error(error);
      alert('Ошибка при добавлении групп');
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
        <Button
          onClick={() => router.back()}
          sx={{ mt: 2 }}
        >
          Вернуться назад
        </Button>
      </Container>
    );
  }

  // Фильтруем группы, которые уже есть на курсе, чтобы не показывать их в диалоге
  const availableGroups = allTeacherGroups.filter(
    (teacherGroup) => !discipline?.groups.some((courseGroup) => courseGroup.id === teacherGroup.id)
  );

  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={ru}
    >
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
          <Box sx={{ flexGrow: 1 }} />
          {isTeacher &&
            tabValue === 0 &&
            (editMode ? (
              <Stack
                direction="row"
                spacing={2}
              >
                <Button
                  startIcon={<Close />}
                  onClick={() => setEditMode(false)}
                >
                  Отменить
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Check />}
                  onClick={handleSaveStructure}
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

        <Typography
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          {discipline.description}
        </Typography>

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => !editMode && setTabValue(newValue)}
          sx={{ mb: 4 }}
        >
          <Tab
            label="Структура курса"
            disabled={editMode}
          />
          <Tab
            label="Группы"
            disabled={editMode}
          />
        </Tabs>

        {tabValue === 0 && (
          <Card elevation={3}>
            <CardContent>
              {editMode ? (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable
                    droppableId="chapters"
                    type="CHAPTERS"
                  >
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {discipline.chapters?.map((chapter, chapterIndex) => (
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
                                  sx={{
                                    p: 2,
                                    bgcolor: 'background.paper',
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                  }}
                                >
                                  <div {...provided.dragHandleProps}>
                                    <DragHandle sx={{ mr: 2 }} />
                                  </div>
                                  <Folder sx={{ mr: 2, color: 'text.secondary' }} />
                                  {/* --- ИЗМЕНЕНИЕ: TextField для названия главы --- */}
                                  <TextField
                                    variant="standard"
                                    fullWidth
                                    value={chapter.title}
                                    onChange={(e) => handleNameChange('chapter', chapter.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <IconButton
                                    onClick={() => toggleChapter(chapter.id)}
                                    sx={{ ml: 1 }}
                                  >
                                    {expandedChapters[chapter.id] ? <ExpandLess /> : <ExpandMore />}
                                  </IconButton>
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
                                        style={{ paddingLeft: '40px' }}
                                      >
                                        <List
                                          dense
                                          disablePadding
                                        >
                                          {chapter.tests?.map((test, testIndex) => (
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
                                                  sx={{ borderLeft: '2px solid', borderColor: 'divider', mb: 0.5 }}
                                                >
                                                  <ListItemButton>
                                                    <div {...provided.dragHandleProps}>
                                                      <DragHandle sx={{ mr: 2 }} />
                                                    </div>
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
                                                    {/* --- ИЗМЕНЕНИЕ: TextField для названия теста --- */}
                                                    <TextField
                                                      variant="standard"
                                                      fullWidth
                                                      value={test.name}
                                                      onChange={(e) =>
                                                        handleNameChange('test', chapter.id, e.target.value, test.id)
                                                      }
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
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
                  {discipline.chapters?.length > 0 ? (
                    discipline.chapters.map((chapter) => (
                      <Paper
                        key={chapter.id}
                        elevation={2}
                        sx={{ mb: 2 }}
                      >
                        <ListItemButton onClick={() => toggleChapter(chapter.id)}>
                          <Folder sx={{ mr: 2, color: 'text.secondary' }} />
                          <ListItemText primary={chapter.title} />
                          <ExpandMore
                            sx={{
                              transform: expandedChapters[chapter.id] ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.2s',
                            }}
                          />
                        </ListItemButton>
                        <Collapse in={expandedChapters[chapter.id]}>
                          {chapter.tests?.length > 0 ? (
                            <List
                              dense
                              disablePadding
                              sx={{ pl: 4 }}
                            >
                              {chapter.tests.map((test) => (
                                <ListItem
                                  key={test.id}
                                  secondaryAction={
                                    isTeacher && (
                                      <Checkbox
                                        edge="end"
                                        checked={test.selected || false}
                                        onChange={(e) => handleTestSelect(test.id, e.target.checked)}
                                      />
                                    )
                                  }
                                >
                                  <ListItemButton onClick={() => router.push(`/test/${test.id}/edit`)}>
                                    <Avatar sx={{ bgcolor: 'background.default', width: 24, height: 24, mr: 2 }}>
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
                          ) : (
                            <Box sx={{ p: 2, pl: 4, color: 'text.secondary' }}>
                              <Typography>В этой главе пока нет тестов.</Typography>
                            </Box>
                          )}
                        </Collapse>
                      </Paper>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <Typography>В этой дисциплине пока нет глав.</Typography>
                      <Typography variant="body2">
                        Нажмите &quot;Редактировать&quot;, чтобы добавить первую главу.
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {tabValue === 1 && (
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600 }}
                >
                  Группы на курсе
                </Typography>
                {isTeacher && (
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={handleOpenAddGroupDialog}
                  >
                    Добавить группу
                  </Button>
                )}
              </Box>
              {discipline.groups?.length > 0 ? (
                <List>
                  {discipline.groups.map((group) => (
                    <Paper
                      key={group.id}
                      elevation={2}
                      sx={{ mb: 2 }}
                    >
                      <ListItemButton onClick={() => toggleGroup(group.id)}>
                        {isTeacher && (
                          <Checkbox
                            edge="start"
                            checked={group.selected || false}
                            indeterminate={group.indeterminate}
                            onChange={(e) => handleGroupSelect(group.id, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <Groups sx={{ mr: 2, color: 'text.secondary' }} />
                        <ListItemText
                          primary={group.name}
                          secondary={`${group.students.length} студентов`}
                        />
                        <Button
                          variant="outlined"
                          style={{ marginRight: '30px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/teacher/discipline/${discipline.id}/group/${group.id}/progress`);
                          }}
                        >
                          Перейти к успеваемости группы
                        </Button>
                        <ExpandMore
                          sx={{
                            transform: expandedGroups[group.id] ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </ListItemButton>
                      <Collapse in={expandedGroups[group.id]}>
                        <List
                          dense
                          disablePadding
                          sx={{ pl: 4 }}
                        >
                          {group.students.map((student) => (
                            <ListItem
                              key={student.id}
                              secondaryAction={
                                isTeacher && (
                                  <Checkbox
                                    edge="end"
                                    checked={student.selected || false}
                                    onChange={(e) => handleStudentSelect(group.id, student.id, e.target.checked)}
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
              ) : (
                <Typography color="text.secondary">К этой дисциплине пока не привязана ни одна группа.</Typography>
              )}
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
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle1"
                sx={{ mb: 1 }}
              >
                Выбранные тесты:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
              <Typography
                variant="subtitle1"
                sx={{ mb: 2 }}
              >
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
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                  <Timer
                    fontSize="small"
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="body2">Осталось: {calculateTimeLeft(deadline)}</Typography>
                </Box>
              )}
            </Box>

            <Typography
              variant="subtitle1"
              sx={{ mb: 2 }}
            >
              Выберите группы и студентов:
            </Typography>
            <List>
              {discipline.groups.map((group) => (
                <Paper
                  key={group.id}
                  elevation={2}
                  sx={{ mb: 2 }}
                >
                  <ListItemButton onClick={() => toggleGroup(group.id)}>
                    <Checkbox
                      edge="start"
                      checked={group.selected || false}
                      indeterminate={group.indeterminate}
                      onChange={(e) => handleGroupSelect(group.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Groups sx={{ mr: 2, color: 'text.secondary' }} />
                    <ListItemText
                      primary={group.name}
                      secondary={`${group.students.length} студентов`}
                    />
                    <ExpandMore
                      sx={{
                        transform: expandedGroups[group.id] ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </ListItemButton>
                  <Collapse in={expandedGroups[group.id]}>
                    <List
                      dense
                      disablePadding
                      sx={{ pl: 4 }}
                    >
                      {group.students.map((student) => (
                        <ListItem
                          key={student.id}
                          secondaryAction={
                            <Checkbox
                              edge="end"
                              checked={student.selected || false}
                              onChange={(e) => handleStudentSelect(group.id, student.id, e.target.checked)}
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
              disabled={!deadline || !discipline.groups.some((g) => g.selected || g.students.some((s) => s.selected))}
            >
              Выдать тесты
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог добавления групп */}
        <Dialog
          open={addGroupDialogOpen}
          onClose={() => setAddGroupDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Добавить группы на курс</DialogTitle>
          <DialogContent dividers>
            {availableGroups.length > 0 ? (
              <List>
                {availableGroups.map((group) => (
                  <ListItem
                    key={group.id}
                    disablePadding
                  >
                    <ListItemButton onClick={() => handleToggleGroupToAdd(group.id)}>
                      <Checkbox
                        edge="start"
                        checked={groupsToAdd.includes(group.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                      <ListItemText
                        primary={group.name}
                        secondary={`${group.students?.length || 0} студентов`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography
                color="text.secondary"
                sx={{ p: 2, textAlign: 'center' }}
              >
                Все ваши группы уже добавлены на этот курс, или у вас нет групп.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddGroupDialogOpen(false)}>Отмена</Button>
            <Button
              variant="contained"
              onClick={handleConfirmAddGroups}
              disabled={groupsToAdd.length === 0}
            >
              Добавить
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
}
