import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      )
    }

    if (!process.env.SCRAPE_CREATORS_API_KEY) {
      return NextResponse.json(
        { error: 'Scrape Creators API key not configured' },
        { status: 500 }
      )
    }

    console.log('Processing URL with Scrape Creators:', url)

    // Validate and clean YouTube URL
    let videoId: string
    try {
      // Extract video ID from various YouTube URL formats
      const urlObj = new URL(url)
      if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v') || ''
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1)
      } else {
        throw new Error('Invalid YouTube URL')
      }

      if (!videoId) {
        throw new Error('Could not extract video ID')
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      )
    }

    // Create a clean YouTube URL
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`

    console.log('Making request to Scrape Creators API...')

    // Make request to Scrape Creators API
    const scrapeResponse = await fetch(
      'https://api.scrapecreators.com/v1/youtube/transcript',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SCRAPE_CREATORS_API_KEY}`,
          'User-Agent': 'YouTube Transcriber App/1.0'
        },
        body: JSON.stringify({
          url: cleanUrl,
          format: 'text', // or 'json' if you want timestamps
          language: 'en' // optional: specify language preference
        })
      }
    )

    if (!scrapeResponse.ok) {
      const errorData = await scrapeResponse.json().catch(() => ({}))

      if (scrapeResponse.status === 404) {
        return NextResponse.json(
          {
            error:
              'No captions found for this video. The video may not have captions or they may be disabled.'
          },
          { status: 400 }
        )
      } else if (scrapeResponse.status === 403) {
        return NextResponse.json(
          {
            error: 'Video is private or restricted. Please try a public video.'
          },
          { status: 400 }
        )
      } else if (scrapeResponse.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a few minutes.' },
          { status: 429 }
        )
      } else if (scrapeResponse.status >= 500) {
        return NextResponse.json(
          {
            error:
              'Scrape Creators service is temporarily unavailable. Please try again later.'
          },
          { status: 503 }
        )
      } else {
        return NextResponse.json(
          {
            error:
              errorData.message || 'Failed to extract transcript from video'
          },
          { status: scrapeResponse.status }
        )
      }
    }

    const data = await scrapeResponse.json()

    console.log('Scrape Creators response received')

    // Transform the response to match your expected format
    let transcriptText = ''
    let videoTitle = ''
    let audioDuration: number | undefined

    if (data.transcript) {
      if (typeof data.transcript === 'string') {
        transcriptText = data.transcript
      } else if (Array.isArray(data.transcript)) {
        // If transcript is an array of objects with timestamps
        transcriptText = data.transcript
          .map((item: any) => item.text || item.content || '')
          .join(' ')
          .trim()
      } else if (data.transcript.text) {
        transcriptText = data.transcript.text
      }
    }

    // Get video metadata if available
    if (data.video) {
      videoTitle = data.video.title || data.title || 'YouTube Video'
      audioDuration = data.video.duration || data.duration
    } else {
      videoTitle = data.title || 'YouTube Video'
      audioDuration = data.duration
    }

    // If no transcript text was extracted
    if (!transcriptText || transcriptText.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            'No transcript text could be extracted from this video. The video may not have captions available.'
        },
        { status: 400 }
      )
    }

    console.log('Transcript extraction completed successfully')

    return NextResponse.json({
      text: transcriptText.trim(),
      status: 'completed',
      audio_duration: audioDuration,
      video_title: videoTitle,
      service: 'scrape_creators'
    })
  } catch (error) {
    console.error('Scrape Creators transcription error:', error)

    if (error instanceof Error) {
      // Handle network errors
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          {
            error:
              'Network error occurred. Please check your internet connection and try again.'
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the transcript' },
      { status: 500 }
    )
  }
}
