'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';

interface TagSelectionModalProps {
  open: boolean;
  onClose: () => void;
  availableTags: string[];
  questionTags: string[];
  onAddTag: (tag: string) => void;
}

export default function TagSelectionModal({
  open,
  onClose,
  availableTags,
  questionTags,
  onAddTag,
}: TagSelectionModalProps) {
  const [search, setSearch] = useState('');
  const [draftTag, setDraftTag] = useState('');

  useEffect(() => {
    if (open) {
      setSearch('');
      setDraftTag('');
    }
  }, [open]);

  const filteredTags = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return availableTags
      .filter((tag) => !questionTags.includes(tag))
      .filter((tag) => tag.toLowerCase().includes(normalizedSearch));
  }, [availableTags, questionTags, search]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Добавление темы к вопросу</DialogTitle>
      <DialogContent style={{ paddingTop: '10px' }}>
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          label="Поиск по существующим темам"
          fullWidth
          sx={{ mb: 2 }}
        />

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          Выберите одну из существующих тем или добавьте новую.
        </Typography>

        <Box
          sx={{
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            mb: 2,
          }}
        >
          <List disablePadding>
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => (
                <ListItem
                  key={tag}
                  disablePadding
                >
                  <ListItemButton onClick={() => onAddTag(tag)}>
                    <ListItemText primary={tag} />
                  </ListItemButton>
                </ListItem>
              ))
            ) : (
              <ListItem disablePadding>
                <ListItemText
                  primary={search ? 'Совпадений не найдено' : 'Нет доступных тем'}
                  primaryTypographyProps={{ color: 'text.secondary', sx: { p: 2 } }}
                />
              </ListItem>
            )}
          </List>
        </Box>

        <TextField
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          label="Новая тема"
          fullWidth
          placeholder="Введите имя новой темы"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={() => {
            onAddTag(draftTag);
            setDraftTag('');
          }}
          disabled={draftTag.trim() === ''}
        >
          Добавить тему
        </Button>
      </DialogActions>
    </Dialog>
  );
}
