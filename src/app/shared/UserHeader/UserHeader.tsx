'use client';

import { Box, Typography, Card, CardContent, Avatar, Menu, MenuItem, CircularProgress } from '@mui/material';
import { Person, Lock, Logout } from '@mui/icons-material';
import { useState } from 'react';

interface Me {
  first_name: string;
  last_name: string;
  role_id: number;
}

interface UserHeaderProps {
  me: Me | null;
  meLoading: boolean;
  onLogout: () => void;
  onChangePassword: () => void;
}

export default function UserHeader({ me, meLoading, onLogout, onChangePassword }: UserHeaderProps) {
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  return (
    <Box sx={{ position: 'fixed', right: 32, top: 32, zIndex: 1000 }}>
      <Card
        variant="outlined"
        onClick={handleUserMenuOpen}
        sx={{
          width: 'auto',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 2,
          },
        }}
      >
        <CardContent sx={{ p: 2 }}>
          {meLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                p: 4,
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <Person />
                </Avatar>
                <Typography variant="subtitle1">{me ? `${me.first_name} ${me.last_name}` : 'Пользователь'}</Typography>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                {me?.role_id === 2 ? 'Преподаватель' : 'Студент'}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Menu
        anchorEl={userMenuAnchorEl}
        open={Boolean(userMenuAnchorEl)}
        onClose={handleUserMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            onChangePassword();
            handleUserMenuClose();
          }}
        >
          <Lock
            fontSize="small"
            sx={{ mr: 1 }}
          />
          Изменить пароль
        </MenuItem>
        <MenuItem
          onClick={() => {
            onLogout();
            handleUserMenuClose();
          }}
        >
          <Logout
            fontSize="small"
            sx={{ mr: 1 }}
          />
          Выйти
        </MenuItem>
      </Menu>
    </Box>
  );
}
