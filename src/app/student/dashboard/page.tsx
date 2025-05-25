'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/profile', {
      method: 'GET',
      credentials: 'include', 
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Ошибка');
        }
        return res.json();
      })
      .then(setUser)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Загрузка...</p>;
  if (error) return <p style={{ color: 'red' }}>Ошибка: {error}</p>;

  return (
    <div>
      <h1>Профиль пользователя</h1>
      <p><strong>Имя:</strong> {user.first_name} {user.last_name}</p>
      <p><strong>Логин:</strong> {user.username}</p>
      <p><strong>Группа:</strong> {user.group || '—'}</p>
      <p><strong>Роль:</strong> {user.role_id === 1 ? 'Студент' : 'Преподаватель'}</p>
    </div>
  );
}
