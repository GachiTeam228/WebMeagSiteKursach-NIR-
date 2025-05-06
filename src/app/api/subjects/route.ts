import { NextResponse } from 'next/server'
import { db } from '@lib/db'

export async function GET() {
  try {
    const subjects = db.prepare('SELECT * FROM Subjects').all()
    
    return NextResponse.json(subjects, { status: 200 })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch subjects' },
      { status: 500 }
    )
  }
}