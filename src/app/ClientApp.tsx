'use client';

import { useEffect, useState } from 'react';
import ActivityTracker from '@/app/shared/ActivityTracker/ActivityTracker';

export default function ClientApp({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        if (data.role_id !== 1) {
          return;
        }
        setUserId(data.id);
      } catch (e) {
        console.error(e);
      }
    };

    fetchUser();
  }, []);

  return (
    <>
      <ActivityTracker userId={userId} />
      {children}
    </>
  );
}
