import { NextRequest, NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'
import ytdl from '@distube/ytdl-core'

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      )
    }

    if (!process.env.ASSEMBLYAI_API_KEY) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    console.log('Processing URL:', url)

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

    // Validate URL with ytdl
    if (!ytdl.validateURL(cleanUrl)) {
      return NextResponse.json(
        { error: 'Invalid or inaccessible YouTube video' },
        { status: 400 }
      )
    }

    let info, title, audioStream

    try {
      // Get video info with retry logic
      console.log('Getting video info...')
      info = await ytdl.getInfo(cleanUrl)
      title = info.videoDetails.title
      console.log(`Video title: ${title}`)

      // Check if video is available
      if (info.videoDetails.isLiveContent) {
        return NextResponse.json(
          { error: 'Live videos are not supported' },
          { status: 400 }
        )
      }

      // Get audio formats and sort by quality
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
      console.log(`Found ${audioFormats.length} audio formats`)

      if (audioFormats.length === 0) {
        return NextResponse.json(
          { error: 'No audio tracks found in this video' },
          { status: 400 }
        )
      }

      // For long videos, prefer lower bitrate formats to reduce size
      const videoDuration = parseInt(info.videoDetails.lengthSeconds || '0')
      const isLongVideo = videoDuration > 1800 // 30 minutes

      let bestAudio
      if (isLongVideo) {
        // For long videos, prioritize smaller file sizes
        console.log('Long video detected, selecting lower quality audio...')
        bestAudio = audioFormats
          .filter((format) => {
            const bitrate = parseInt(format.audioBitrate || '0')
            return bitrate <= 128 && bitrate > 0 // Max 128kbps for long videos
          })
          .sort(
            (a, b) =>
              parseInt(a.audioBitrate || '0') - parseInt(b.audioBitrate || '0')
          )[0] // Lowest quality first

        if (!bestAudio) {
          // Fallback to any available format
          bestAudio = audioFormats.sort(
            (a, b) =>
              parseInt(a.audioBitrate || '0') - parseInt(b.audioBitrate || '0')
          )[0]
        }
      } else {
        // For shorter videos, prefer higher quality
        bestAudio =
          audioFormats
            .filter(
              (format) =>
                format.container === 'm4a' || format.container === 'mp4'
            )
            .sort(
              (a, b) =>
                parseInt(b.audioBitrate || '0') -
                parseInt(a.audioBitrate || '0')
            )[0] || audioFormats[0]
      }

      console.log(
        `Selected format: ${bestAudio.container}, bitrate: ${
          bestAudio.audioBitrate
        }, duration: ${Math.round(videoDuration / 60)} minutes`
      )

      // Create audio stream with additional options
      audioStream = ytdl(cleanUrl, {
        format: bestAudio,
        filter: 'audioonly',
        quality: 'highestaudio',
        requestOptions: {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      })
    } catch (error) {
      console.error('Error getting video info:', error)
      return NextResponse.json(
        {
          error:
            'Failed to access video. The video might be private, age-restricted, or temporarily unavailable.'
        },
        { status: 400 }
      )
    }

    try {
      // For larger videos, stream directly to AssemblyAI instead of buffering
      console.log('Streaming audio to AssemblyAI...')

      // Try to get content length to estimate size
      const contentLength = audioStream.headers?.['content-length']
      const estimatedSize = contentLength ? parseInt(contentLength) : 0

      if (estimatedSize > 100 * 1024 * 1024) {
        // 100MB limit
        return NextResponse.json(
          { error: 'Video is too large (>100MB). Please try a shorter video.' },
          { status: 400 }
        )
      }

      // Method 1: Try streaming upload first (more memory efficient)
      let uploadUrl: string
      try {
        console.log('Attempting stream upload...')
        uploadUrl = await client.files.upload(audioStream)
        console.log('Stream upload successful')
      } catch (streamError) {
        console.log('Stream upload failed, falling back to buffer method...')

        // Method 2: Fallback to buffering for smaller files
        const chunks: Buffer[] = []
        let totalSize = 0
        const maxSize = 75 * 1024 * 1024 // 75MB limit for buffer method

        // Create new stream since the previous one may be consumed
        const newAudioStream = ytdl(cleanUrl, {
          format: bestAudio,
          filter: 'audioonly',
          quality: 'highestaudio',
          requestOptions: {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }
        })

        const timeout = setTimeout(() => {
          newAudioStream.destroy()
        }, 600000) // 10 minute timeout

        try {
          for await (const chunk of newAudioStream) {
            chunks.push(chunk)
            totalSize += chunk.length

            if (totalSize > maxSize) {
              clearTimeout(timeout)
              return NextResponse.json(
                {
                  error:
                    'Video is too large for processing. Please try a video under 1 hour.'
                },
                { status: 400 }
              )
            }
          }

          clearTimeout(timeout)
          const audioBuffer = Buffer.concat(chunks)
          console.log(
            `Audio downloaded: ${(audioBuffer.length / 1024 / 1024).toFixed(
              2
            )}MB`
          )

          uploadUrl = await client.files.upload(audioBuffer)
        } catch (bufferError) {
          clearTimeout(timeout)
          throw bufferError
        }
      }

      console.log('Upload complete, starting transcription...')

      // Request transcription with retry logic
      let transcript
      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        try {
          console.log(`Transcription attempt ${retryCount + 1}/${maxRetries}`)

          transcript = await client.transcripts.transcribe({
            audio: uploadUrl,
            language_code: 'en_us',
            // Add some additional options for better reliability
            dual_channel: false,
            format_text: true
          })

          // If we get here, the request succeeded
          break
        } catch (transcribeError) {
          retryCount++
          console.error(
            `Transcription attempt ${retryCount} failed:`,
            transcribeError
          )

          if (retryCount >= maxRetries) {
            // All retries exhausted
            if (
              transcribeError instanceof Error &&
              transcribeError.message.includes('502')
            ) {
              return NextResponse.json(
                {
                  error:
                    'AssemblyAI service is temporarily unavailable. Please try again in a few minutes.'
                },
                { status: 503 }
              )
            } else if (
              transcribeError instanceof Error &&
              transcribeError.message.includes('5')
            ) {
              return NextResponse.json(
                { error: 'AssemblyAI service error. Please try again later.' },
                { status: 503 }
              )
            } else {
              throw transcribeError // Re-throw if it's not a server error
            }
          }

          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000 // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }

      if (!transcript) {
        return NextResponse.json(
          { error: 'Failed to start transcription after multiple attempts.' },
          { status: 500 }
        )
      }

      if (transcript.status === 'error') {
        return NextResponse.json(
          { error: `Transcription failed: ${transcript.error}` },
          { status: 500 }
        )
      }

      console.log('Transcription complete')

      return NextResponse.json({
        text: transcript.text,
        status: transcript.status,
        audio_duration: transcript.audio_duration,
        video_title: title
      })
    } catch (error) {
      console.error('Error during audio processing:', error)
      return NextResponse.json(
        { error: 'Failed to process audio stream. Please try again.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Transcription error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
