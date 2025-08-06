import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'

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

    // Create a clean YouTube URL and encode it for the query parameter
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`
    const encodedUrl = encodeURIComponent(cleanUrl)

    // Get video info using ytdl for consistent title extraction
    let fallbackTitle = 'YouTube Video'
    let fallbackDuration: number | undefined

    try {
      console.log('Getting video info with ytdl...')
      if (ytdl.validateURL(cleanUrl)) {
        const info = await ytdl.getInfo(cleanUrl)
        fallbackTitle = info.videoDetails.title
        fallbackDuration = parseInt(info.videoDetails.lengthSeconds || '0')
        console.log(`Video title from ytdl: ${fallbackTitle}`)
        console.log(`Video duration from ytdl: ${fallbackDuration} seconds`)
      }
    } catch (ytdlError) {
      console.warn('Could not get video info from ytdl:', ytdlError)
      // Continue with Scrape Creators - this is just for fallback title
    }

    console.log('Making request to Scrape Creators API...')

    // Make request to Scrape Creators API using the correct endpoint structure
    const apiUrl = `https://api.scrapecreators.com/v1/youtube/video/transcript?url=${encodedUrl}`
    console.log('API URL:', apiUrl)
    console.log(
      'Using API key:',
      process.env.SCRAPE_CREATORS_API_KEY?.substring(0, 8) + '...'
    )

    // Create an AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    let scrapeResponse
    try {
      scrapeResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': process.env.SCRAPE_CREATORS_API_KEY,
          'User-Agent': 'YouTube Transcriber App/1.0',
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      console.log('Scrape Creators API response status:', scrapeResponse.status)
      console.log(
        'Scrape Creators API response headers:',
        Object.fromEntries(scrapeResponse.headers.entries())
      )
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error('Fetch error:', fetchError)

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          {
            error:
              'Request timed out. The Scrape Creators service is taking too long to respond.'
          },
          { status: 504 }
        )
      }

      throw fetchError
    }

    if (!scrapeResponse.ok) {
      let errorData
      try {
        errorData = await scrapeResponse.json()
      } catch {
        errorData = {}
      }

      console.error(
        'Scrape Creators API error:',
        scrapeResponse.status,
        errorData
      )

      if (scrapeResponse.status === 404) {
        return NextResponse.json(
          {
            error:
              'No transcript found for this video. The video may not have a transcript available or it may be private.'
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
      } else if (scrapeResponse.status === 401) {
        return NextResponse.json(
          {
            error:
              'Invalid API key. Please check your Scrape Creators API configuration.'
          },
          { status: 500 }
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
              errorData.message ||
              errorData.error ||
              'Failed to extract transcript from video'
          },
          { status: scrapeResponse.status }
        )
      }
    }

    const data = await scrapeResponse.json()

    console.log('Scrape Creators response received:', data)

    // Extract transcript data from the response
    let transcriptText = ''
    let videoTitle = ''
    let audioDuration: number | undefined

    // Handle different possible response structures
    if (data.transcript) {
      if (typeof data.transcript === 'string') {
        transcriptText = data.transcript
      } else if (Array.isArray(data.transcript)) {
        // If transcript is an array of segments with text and timestamps
        transcriptText = data.transcript
          .map((segment: any) => {
            // Handle different possible segment structures
            if (typeof segment === 'string') {
              return segment
            } else if (segment.text) {
              return segment.text
            } else if (segment.content) {
              return segment.content
            } else {
              return ''
            }
          })
          .filter((text) => text.trim().length > 0)
          .join(' ')
          .trim()
      } else if (typeof data.transcript === 'object' && data.transcript.text) {
        transcriptText = data.transcript.text
      }
    } else if (data.text) {
      transcriptText = data.text
    } else if (data.content) {
      transcriptText = data.content
    }

    // Extract video metadata with fallback to ytdl data
    if (data.video) {
      videoTitle = data.video.title || data.video.name || fallbackTitle
      audioDuration =
        data.video.duration || data.video.length || fallbackDuration
    } else if (data.title) {
      videoTitle = data.title
      audioDuration =
        data.duration || data.length || data.video_duration || fallbackDuration
    } else if (data.name) {
      videoTitle = data.name
      audioDuration =
        data.duration || data.length || data.video_duration || fallbackDuration
    } else {
      videoTitle = fallbackTitle
      audioDuration = fallbackDuration
    }

    // Extract duration from various possible locations with fallback
    if (!audioDuration) {
      audioDuration =
        data.duration || data.length || data.video_duration || fallbackDuration
    }

    // If no transcript text was extracted
    if (!transcriptText || transcriptText.trim().length === 0) {
      console.error('No transcript text found in response:', data)
      return NextResponse.json(
        {
          error:
            'No transcript text could be extracted from this video. The video may not have a transcript available.'
        },
        { status: 400 }
      )
    }

    console.log('Transcript extraction completed successfully')
    console.log('Transcript length:', transcriptText.length)
    console.log('Video title:', videoTitle)

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
      if (
        error.message.includes('fetch') ||
        error.message.includes('ENOTFOUND')
      ) {
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
