import { NextRequest, NextResponse } from 'next/server'
import { transcriptStore } from '@/lib/transcript-store'

// GET - Retrieve all saved transcripts
export async function GET() {
  try {
    const transcripts = transcriptStore.getAll()
    return NextResponse.json(transcripts)
  } catch (error) {
    console.error('Error fetching transcripts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcripts' },
      { status: 500 }
    )
  }
}

// POST - Save a new transcript
export async function POST(request: NextRequest) {
  try {
    const { videoTitle, videoUrl, text, audioDuration, serviceUsed } =
      await request.json()

    if (!videoTitle || !videoUrl || !text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const savedTranscript = transcriptStore.save({
      videoTitle,
      videoUrl,
      text,
      audioDuration,
      serviceUsed: serviceUsed || 'assemblyai' // default to assemblyai for backward compatibility
    })

    return NextResponse.json(savedTranscript, { status: 201 })
  } catch (error) {
    console.error('Error saving transcript:', error)
    return NextResponse.json(
      { error: 'Failed to save transcript' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a transcript
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Transcript ID is required' },
        { status: 400 }
      )
    }

    const deleted = transcriptStore.delete(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transcript:', error)
    return NextResponse.json(
      { error: 'Failed to delete transcript' },
      { status: 500 }
    )
  }
}
