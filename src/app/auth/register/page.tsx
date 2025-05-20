// pages/auth/login.tsx
'use client';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Link,
    Divider,
    InputAdornment,
    IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConf, setShowPasswordConf] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(formData.password.length < 8) {
            setError('Длина пароля должна быть больше 7 символов');
            return;
        }
        if(formData.confirmPassword !== formData.password) {
            setError('Пароли не совпадают');
            return;
        }

        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: formData.username,
                password: formData.password,
            }),
        });
        if (res.ok) {
            router.push('/');
        } else {
            const data = await res.json();
            setError(data.message || 'Ошибка регистрации');
        }
    };

    return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    p: 4,
                    borderRadius: 2,
                    boxShadow: 1,
                }}
            >
                <Typography
                    variant="h4"
                    component="h1"
                    sx={{ mb: 3, fontWeight: 700 }}
                >
                    Вход в систему
                </Typography>

                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{ width: '100%' }}
                >
                    <TextField
                        label="Имя пользователя"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        required
                        value={formData.username}
                        onChange={(e) => {
                            setFormData({ ...formData, username: e.target.value })
                            if(error !== '') setError('');
                        }}
                    />

                    <TextField
                        label="Пароль"
                        type={showPassword ? 'text' : 'password'}
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        required
                        value={formData.password}
                        onChange={(e) => {
                            setFormData({
                                ...formData,
                                password: e.target.value,
                            })
                        }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        edge="end"
                                    >
                                        {showPassword ? (
                                            <VisibilityOff />
                                        ) : (
                                            <Visibility />
                                        )}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <TextField
                        label="Подтвердите пароль"
                        type={showPasswordConf ? 'text' : 'password'}
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => {
                            setFormData({
                                ...formData,
                                confirmPassword: e.target.value,
                            })
                            if(error !== '') setError('');
                        }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() =>
                                            setShowPasswordConf(!showPasswordConf)
                                        }
                                        edge="end"
                                    >
                                        {showPasswordConf ? (
                                            <VisibilityOff />
                                        ) : (
                                            <Visibility />
                                        )}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    {error && (
                        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                            {error}
                        </Typography>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        sx={{ mt: 3, mb: 2, py: 1.5 }}
                    >
                        Войти
                    </Button>

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Link href="/auth/login" variant="body2">
                            Есть аккаунт? Войдите
                        </Link>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}
