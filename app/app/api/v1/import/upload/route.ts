import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('csv') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No CSV file provided' },
        { status: 400 }
      )
    }
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mock successful upload
    const uploadId = `upload_${Date.now()}`
    
    return NextResponse.json({
      uploadId,
      status: 'completed',
      totalRows: 25,
      importedRows: 23,
      duplicateRows: 2,
      errors: [],
      processingTime: 2000
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 