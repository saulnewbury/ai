import { NextRequest, NextResponse } from 'next/server'
import { transcriptStore } from '@/lib/transcript-store'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // Explicitly type params as a Promise
) {
  try {
    const { id } = await context.params // Await the params to resolve the Promise
    const transcript = transcriptStore.getById(id)

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(transcript)
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    )
  }
}
