// components/ImageUpload.tsx

'use client';

import { useState } from 'react';
import { Box, Button, IconButton, CircularProgress, Alert } from '@mui/material';
import { CloudUpload, Delete } from '@mui/icons-material';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (url: string | null) => void;
  uploadType?: 'question' | 'answerOption'; // Новый проп
}

export default function ImageUpload({
  currentImageUrl,
  onImageChange,
  uploadType = 'question', // По умолчанию для вопроса
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера на клиенте
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB');
      return;
    }

    // Проверка типа
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Разрешены только изображения (JPEG, PNG, GIF, WebP)');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      // Для совместимости с обеими ручками используем ключ 'file'
      formData.append('file', file);

      const apiUrl = uploadType === 'answerOption' ? '/api/upload/answer-option-image' : '/api/upload/question-image';

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка загрузки');
      }

      const data = await response.json();
      setPreview(data.url);
      onImageChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!preview) return;

    try {
      const filename = preview.split('/').pop();
      const apiUrl = uploadType === 'answerOption' ? '/api/upload/answer-option-image' : '/api/upload/question-image';

      await fetch(`${apiUrl}?filename=${filename}`, {
        method: 'DELETE',
      });

      setPreview(null);
      onImageChange(null);
    } catch (err) {
      console.error('Error deleting image:', err);
    }
  };

  return (
    <Box>
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {preview ? (
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Box
            component="img"
            src={preview}
            alt="Preview"
            sx={{
              maxWidth: uploadType === 'question' ? '100%' : '100px',
              maxHeight: uploadType === 'question' ? '300px' : '100px',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
          <IconButton
            onClick={handleDelete}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'error.main', color: 'white' },
            }}
            size="small"
          >
            <Delete />
          </IconButton>
        </Box>
      ) : (
        <Button
          component="label"
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
          disabled={uploading}
        >
          {uploading ? 'Загрузка...' : 'Загрузить изображение'}
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={handleFileChange}
          />
        </Button>
      )}
    </Box>
  );
}
