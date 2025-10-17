import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Функция для верификации токена
async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch (err) {
    return err;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tokenCookie = request.cookies.get('token');

  const token = tokenCookie?.value;
  const payload = token ? ((await verifyToken(token)) as { username: string; role: number }) : null;

  // 1. Если пользователь не аутентифицирован
  if (!payload) {
    // Разрешаем доступ к публичным страницам
    if (pathname === '/auth/login' || pathname === '/') {
      return NextResponse.next();
    }
    // Всех остальных перенаправляем на логин
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // 2. Если пользователь аутентифицирован
  const userRole = payload.role as number;

  const teacherRole = 2;
  const studentRole = 1;

  // Определяем роуты и требуемые роли
  const roleBasedRoutes: Record<string, number[]> = {
    '/teacher/dashboard': [teacherRole],
    '/dashboard': [studentRole],
    '/admin': [teacherRole],
  };

  // Проверяем доступ к защищенным роутам
  for (const route in roleBasedRoutes) {
    if (pathname.startsWith(route)) {
      const requiredRoles = roleBasedRoutes[route];

      if (!requiredRoles.includes(userRole)) {
        // Перенаправляем на страницу с ошибкой доступа
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
    }
  }

  // Если пользователь аутентифицирован и пытается зайти на страницу логина,
  // перенаправим его на соответствующий дашборд
  if (pathname === '/auth/login') {
    if (userRole === teacherRole) {
      return NextResponse.redirect(new URL('/teacher/dashboard', request.url));
    }
    if (userRole === studentRole) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Конфигурация путей, на которых будет работать Middleware
export const config = {
  matcher: [
    /*
     * Сопоставляем все пути, кроме тех, что начинаются с:
     * - api (API-маршруты)
     * - _next/static (статические файлы)
     * - _next/image (файлы оптимизации изображений)
     * - favicon.ico (иконка)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
