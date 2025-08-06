import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'

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
    const { url } = await request.json()

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

    // Get video metadata using ytdl for title and duration (as fallback)
    let videoTitle = 'YouTube Video'
    let audioDuration: number | undefined

    try {
      console.log('Getting video info with ytdl for metadata...')
      if (ytdl.validateURL(cleanUrl)) {
        const info = await ytdl.getInfo(cleanUrl)
        videoTitle = info.videoDetails.title
        audioDuration = parseInt(info.videoDetails.lengthSeconds || '0')
        console.log(`Video title: ${videoTitle}`)
        console.log(`Video duration: ${audioDuration} seconds`)
      }
    } catch (ytdlError) {
      console.warn('Could not get video info from ytdl:', ytdlError)
      // Continue anyway - we'll try to get transcript without metadata
    }

    // Call Python FastAPI microservice for transcript
    const pythonServiceUrl =
      process.env.PYTHON_TRANSCRIPT_SERVICE_URL || 'http://localhost:8001'
    const transcriptUrl = `${pythonServiceUrl}/transcript`

    console.log('Calling Python transcript service at:', transcriptUrl)

    try {
      const response = await fetch(transcriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: cleanUrl }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Python service error:', response.status, errorData)

        if (response.status === 404) {
          return NextResponse.json(
            {
              error:
                errorData.detail ||
                'No transcript found for this video. The video may not have captions available.'
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
      console.log('Transcript length:', transcriptData.text.length)
      console.log('Language:', transcriptData.language_code)
      console.log('Auto-generated:', transcriptData.is_generated)

      // Return in the format expected by your frontend
      return NextResponse.json({
        text: transcriptData.text,
        status: 'completed',
        audio_duration: audioDuration, // Use ytdl duration as fallback
        video_title: videoTitle, // Use ytdl title as fallback
        service: 'youtube_transcript_api',
        language_code: transcriptData.language_code,
        is_generated: transcriptData.is_generated,
        video_id: transcriptData.video_id
      })
    } catch (fetchError) {
      console.error('Error calling Python transcript service:', fetchError)

      if (fetchError.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Transcript service timed out. Please try again.' },
          { status: 504 }
        )
      }

      if (fetchError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          {
            error:
              'Transcript service is not available. Please make sure the Python service is running.'
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        {
          error:
            'Failed to connect to transcript service. Please try again or use a different service.'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('YouTube transcript API error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the transcript' },
      { status: 500 }
    )
  }
}
