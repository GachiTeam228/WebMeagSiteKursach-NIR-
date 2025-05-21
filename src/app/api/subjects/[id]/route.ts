import { NextResponse } from 'next/server'
import { db } from '@lib/db' 

export async function GET(
  request: Request,
  context: any
) {
  try {
    let { id } = context.params; 
    let nid = parseInt(id)

    if (isNaN(nid)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    const subject = db.prepare('SELECT * FROM Subjects WHERE id = ?').get(nid)

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(subject, { status: 200 })

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}