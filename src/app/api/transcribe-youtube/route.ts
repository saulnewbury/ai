import { NextRequest, NextResponse } from 'next/server'

// Function to extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v')
    } else if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1)
    }
  } catch (e) {
    // Try regex fallback
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    )
    return match ? match[1] : null
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      include_timestamps = false,
      timestamp_format = 'seconds'
    } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      )
    }

    console.log('Processing URL with Python YouTube Transcript API:', url)

    // Extract video ID
    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      )
    }

    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Call Python FastAPI microservice directly - no duplicate metadata fetching
    const pythonServiceUrl =
      process.env.PYTHON_TRANSCRIPT_SERVICE_URL || 'http://localhost:8001'
    const transcriptUrl = `${pythonServiceUrl}/transcript`

    console.log('Calling Python transcript service at:', transcriptUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // Reduced timeout

    try {
      const response = await fetch(transcriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive'
        },
        body: JSON.stringify({
          url: cleanUrl,
          include_timestamps,
          timestamp_format,
          include_metadata: true // Let Python service get title/duration
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Python service error:', response.status, errorData)

        if (response.status === 404) {
          return NextResponse.json(
            {
              error: errorData.detail || 'No transcript found for this video.'
            },
            { status: 400 }
          )
        } else if (response.status === 500) {
          return NextResponse.json(
            {
              error:
                errorData.detail ||
                'Transcript service error. Please try again.'
            },
            { status: 500 }
          )
        } else {
          return NextResponse.json(
            {
              error:
                errorData.detail || 'Failed to extract transcript from video.'
            },
            { status: response.status }
          )
        }
      }

      const transcriptData = await response.json()
      console.log('Transcript extraction completed successfully')

      return NextResponse.json({
        text: transcriptData.text,
        segments: transcriptData.segments || null,
        status: 'completed',
        audio_duration: transcriptData.total_duration,
        video_title: transcriptData.video_title || 'YouTube Video', // From Python service
        service: 'youtube_transcript_api',
        language_code: transcriptData.language_code,
        is_generated: transcriptData.is_generated,
        video_id: transcriptData.video_id,
        total_segments: transcriptData.total_segments,
        total_duration: transcriptData.total_duration,
        include_timestamps: include_timestamps,
        timestamp_format: timestamp_format,
        has_timestamps: include_timestamps && transcriptData.text.includes('['),
        raw_segments: transcriptData.segments
          ? transcriptData.segments.length
          : 0
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('Error calling Python transcript service:', fetchError)

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Transcript service timed out. Please try again.' },
          { status: 504 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to connect to transcript service.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('YouTube transcript API error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the transcript' },
      { status: 500 }
    )
  }
}
