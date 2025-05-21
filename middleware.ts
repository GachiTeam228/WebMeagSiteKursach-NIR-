// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';
// import jwt from 'jsonwebtoken';

// const SECRET = process.env.JWT_SECRET || 'secret123';

// export function middleware(req: NextRequest) {
//   console.log('\n\nssss\n\n');
//   const { pathname } = req.nextUrl;
//   const token = req.cookies.get('token')?.value;

//   const isAuthPage = pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register');
//   const isProtected = !isAuthPage && !pathname.startsWith('/_next') && !pathname.startsWith('/favicon.ico') && !pathname.startsWith('/api');

//   // 🧠 Если пользователь уже вошёл и идёт на login/register → редирект на главную
//   if (isAuthPage && token) {
//     try {
//       jwt.verify(token, SECRET);
//       return NextResponse.redirect(new URL('/', req.url));
//     } catch {
//       // невалидный токен — продолжаем
//     }
//   }

//   // 🔒 Если пользователь НЕ вошёл и идёт на защищённую страницу → редирект на login
//   if (!token && isProtected) {
//     return NextResponse.redirect(new URL('/auth/login', req.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: [ '/:path*'
//     // '/student/dashboard',
//     // '/((?!api|_next/static|_next/image|favicon.ico).*)',
//   ],
// };


// filepath: /home/chsd/nir/WebMeagSiteKursach-NIR-/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  console.log('MIDDLEWARE TEST');
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};