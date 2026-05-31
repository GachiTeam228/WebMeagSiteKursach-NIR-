'use client';

import { useEffect, useRef } from 'react';

// Порог кликов для отправки на сервер
const CLICK_THRESHOLD = 5;

interface ActivityTrackerProps {
  userId: number | null; // ID студента (null если не авторизован)
}

export default function ActivityTracker({ userId }: ActivityTrackerProps) {
  // Используем useRef, чтобы не вызывать ререндер компонента при каждом клике
  const clickCountRef = useRef(0);

  // Сохраняем историю кликов (на каких элементах/url кликали),
  // если захотите анализировать более детально
  const clickBufferRef = useRef<{ url: string; timestamp: number }[]>([]);

  useEffect(() => {
    // Если пользователь не авторизован, не собираем статистику
    if (!userId) return;

    console.log('ActivityTracker запущен для userId:', userId);

    const handleGlobalClick = (event: MouseEvent) => {
      // Игнорируем клики, которые не несут смысловой нагрузки (например, по пустому фону)
      // Обычно полезный клик происходит по кнопкам, ссылкам, чекбоксам и карточкам
      const target = event.target as HTMLElement;
      const isMeaningfulClick =
        target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.MuiCard-root'); // Карточки Material UI

      if (!isMeaningfulClick) return;

      clickCountRef.current += 1;
      clickBufferRef.current.push({
        url: window.location.pathname,
        timestamp: Date.now(),
      });

      // Если накопили 5 кликов — отправляем на сервер
      if (clickCountRef.current >= CLICK_THRESHOLD) {
        sendActivityBatch();
      }
    };

    const sendActivityBatch = async () => {
      const currentCount = clickCountRef.current;
      const currentBuffer = [...clickBufferRef.current];

      // Сразу обнуляем счетчики, чтобы не пропустить клики во время запроса
      clickCountRef.current = 0;
      clickBufferRef.current = [];

      try {
        await fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            action_type: 'BATCH_CLICK',
            click_count: currentCount,
            details: currentBuffer,
          }),
        });
      } catch (error) {
        console.error('Ошибка отправки логов активности:', error);
        // Если запрос упал, можно вернуть клики обратно в буфер
        clickCountRef.current += currentCount;
        clickBufferRef.current = [...currentBuffer, ...clickBufferRef.current];
      }
    };

    // Обязательно отправляем остатки при закрытии страницы или уходе с неё
    const handleBeforeUnload = () => {
      if (clickCountRef.current > 0) {
        // navigator.sendBeacon - надежный способ отправить данные при закрытии вкладки
        const payload = JSON.stringify({
          user_id: userId,
          action_type: 'BATCH_CLICK',
          click_count: clickCountRef.current,
          details: clickBufferRef.current,
        });
        navigator.sendBeacon('/api/activity', new Blob([payload], { type: 'application/json' }));
      }
    };

    // Вешаем слушатели событий
    document.addEventListener('click', handleGlobalClick);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Очистка при размонтировании
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Отправляем остатки при смене роута (в рамках SPA)
      if (clickCountRef.current > 0) {
        sendActivityBatch();
      }
    };
  }, [userId]);

  // Провайдер не рендерит никакого видимого UI
  return null;
}
