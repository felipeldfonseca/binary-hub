import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({
    status: 'ok',
    message: 'API is working correctly',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  
  return NextResponse.json({
    status: 'ok',
    message: 'POST request received',
    data: body,
    timestamp: new Date().toISOString()
  })
} 