// app/api/debug-cookies/route.ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const allCookies = await cookies()
  const token = allCookies.get('token')
  return NextResponse.json({ token })
}
