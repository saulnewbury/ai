// app/api/transcribe-chunked/route.ts - Fixed version
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      chunk_size_minutes = 4,
      max_concurrent = 3
    } = await request.json()

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

    console.log('🚀 Processing URL with optimized chunking service:', url)

    // Call the optimized chunking microservice
    const chunkingServiceUrl =
      process.env.CHUNKING_SERVICE_URL || 'http://localhost:8002'
    const transcriptUrl = `${chunkingServiceUrl}/transcribe-chunked`

    console.log('Calling optimized chunking service at:', transcriptUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minute timeout

    try {
      const response = await fetch(transcriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive'
        },
        body: JSON.stringify({
          url,
          chunk_size_minutes,
          max_concurrent,
          language_code: 'en_us'
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Chunking service error:', response.status, errorData)

        if (response.status === 404) {
          return NextResponse.json(
            {
              error: errorData.detail || 'Video not found or inaccessible.'
            },
            { status: 400 }
          )
        } else if (response.status >= 500) {
          return NextResponse.json(
            {
              error:
                errorData.detail || 'Chunking service error. Please try again.'
            },
            { status: 500 }
          )
        } else {
          return NextResponse.json(
            {
              error: errorData.detail || 'Failed to transcribe video.'
            },
            { status: response.status }
          )
        }
      }

      const transcriptData = await response.json()

      // Add detailed logging to debug the response
      console.log(
        '✅ Raw response from chunking service:',
        JSON.stringify(transcriptData, null, 2)
      )
      console.log('🔍 Response fields check:', {
        has_text: !!transcriptData.text,
        text_length: transcriptData.text ? transcriptData.text.length : 0,
        status: transcriptData.status,
        video_title: transcriptData.video_title,
        service_method: transcriptData.service_method
      })

      // Validate that we have the essential fields
      if (!transcriptData.text) {
        console.error('❌ No text field in response from chunking service')
        return NextResponse.json(
          { error: 'No transcript text received from chunking service' },
          { status: 500 }
        )
      }

      console.log('✅ Optimized transcription completed successfully!')
      console.log(
        `⚡ Processing time: ${transcriptData.processing_time?.toFixed(2)}s`
      )
      console.log(`📦 Service method: ${transcriptData.service_method}`)
      if (transcriptData.total_chunks) {
        console.log(`🔀 Total chunks: ${transcriptData.total_chunks}`)
      }

      // Format response to match frontend expectations
      const formattedResponse = {
        text: transcriptData.text,
        status: transcriptData.status,
        audio_duration:
          transcriptData.audio_duration || transcriptData.total_duration,
        video_title: transcriptData.video_title,
        service_used: 'assemblyai_chunked',
        processing_time: transcriptData.processing_time,
        total_chunks: transcriptData.total_chunks,
        service_method: transcriptData.service_method,
        timing_breakdown: transcriptData.timing_breakdown,
        chunks_info: transcriptData.chunks?.map((chunk) => ({
          chunk_id: chunk.chunk_id,
          status: chunk.status,
          processing_time: chunk.processing_time,
          start_time: chunk.start_time,
          end_time: chunk.end_time,
          success: chunk.status === 'completed'
        }))
      }

      console.log('📤 Sending formatted response to frontend')
      return NextResponse.json(formattedResponse)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('❌ Error calling chunking service:', fetchError)

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Chunking service timed out. Video might be too long.' },
          { status: 504 }
        )
      }

      if (fetchError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          {
            error:
              "Optimized chunking service is not available. Make sure it's running on port 8002."
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to connect to optimized chunking service.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Chunked API error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the transcript' },
      { status: 500 }
    )
  }
}
