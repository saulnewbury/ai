'use client'

import { useState } from 'react'
import Link from 'next/link'

interface TranscriptResult {
  text: string
  status: string
  audio_duration?: number
  video_title?: string
  service_used?: 'assemblyai' | 'assemblyai_chunked' | 'youtube_direct'
  processing_time?: number
  total_chunks?: number
  chunks_info?: Array<{
    chunk_id: number
    status: string
    processing_time?: number
    start_time: number
    end_time: number
    success: boolean
  }>
  segments?: Array<{
    text: string
    start: number
    duration: number
    end: number
    timestamp: string
  }>
  total_segments?: number
  total_duration?: number
  // Additional timestamp info
  include_timestamps?: boolean
  timestamp_format?: string
  has_timestamps?: boolean
  raw_segments?: number
}

// Updated to include all three service types
type TranscriptService = 'assemblyai' | 'assemblyai_chunked' | 'youtube_direct'

export default function Home() {
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedService, setSelectedService] =
    useState<TranscriptService>('youtube_direct')
  const [includeTimestamps, setIncludeTimestamps] = useState(false)
  const [timestampFormat, setTimestampFormat] = useState<
    'seconds' | 'minutes' | 'timecode'
  >('seconds')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTranscript(null)
    setSaved(false)

    try {
      let endpoint: string
      let body: any = { url }

      // Route to the correct API endpoint
      if (selectedService === 'assemblyai') {
        endpoint = '/api/transcribe' // Regular AssemblyAI (single file)
      } else if (selectedService === 'assemblyai_chunked') {
        endpoint = '/api/transcribe-chunked' // AssemblyAI with chunking
      } else {
        endpoint = '/api/transcribe-youtube' // YouTube Direct
        // Add timestamp options for YouTube Direct
        body = {
          url,
          include_timestamps: includeTimestamps,
          timestamp_format: timestampFormat
        }
      }

      console.log('Making request to:', endpoint)
      console.log('Request body:', body)
      console.log('Selected service:', selectedService)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      console.log('Full API Response:', data)
      console.log(
        'Raw transcript text preview:',
        data.text ? data.text.substring(0, 200) : 'NO TEXT FOUND'
      )
      console.log('API Response summary:', {
        status: data.status,
        service: data.service,
        has_timestamps: data.has_timestamps,
        include_timestamps: data.include_timestamps,
        timestamp_format: data.timestamp_format,
        segments: data.segments ? data.segments.length : 0,
        text_length: data.text ? data.text.length : 0,
        text_exists: !!data.text
      })

      if (!response.ok) {
        // Handle different types of errors
        if (response.status === 503) {
          let serviceName = 'Service'
          if (selectedService === 'assemblyai') serviceName = 'AssemblyAI'
          else if (selectedService === 'assemblyai_chunked')
            serviceName = 'AssemblyAI Chunking'
          else serviceName = 'YouTube Direct'

          throw new Error(
            `${serviceName} service is temporarily unavailable. Please try again in a few minutes.`
          )
        } else if (response.status >= 500) {
          throw new Error('Server error occurred. Please try again.')
        } else {
          throw new Error(data.error || 'Failed to transcribe video')
        }
      }

      // Validate that we have transcript text
      if (!data.text) {
        console.error('No transcript text in response:', data)
        throw new Error(
          'No transcript text received from the service. The video may not have captions available.'
        )
      }

      setTranscript({ ...data, service_used: selectedService })
    } catch (err) {
      console.error('Transcription error:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const saveTranscript = async () => {
    if (!transcript) return

    setSaving(true)
    try {
      const response = await fetch('/api/transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoTitle: transcript.video_title || 'YouTube Video',
          videoUrl: url,
          text: transcript.text,
          audioDuration: transcript.audio_duration,
          serviceUsed: transcript.service_used
        })
      })

      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000) // Reset after 3 seconds
      } else {
        alert('Failed to save transcript')
      }
    } catch (err) {
      alert('Error saving transcript')
    } finally {
      setSaving(false)
    }
  }

  // Function to convert timestamp to seconds for URL
  const parseTimestamp = (timestamp: string): number => {
    // Remove brackets and extract the time part
    const timeStr = timestamp.replace(/[\[\]]/g, '')

    if (timeStr.includes('s')) {
      // Format: "123.4s"
      return parseFloat(timeStr.replace('s', ''))
    } else if (timeStr.includes(':')) {
      // Format: "02:03.4" or "01:02:03.4"
      const parts = timeStr.split(':')
      if (parts.length === 2) {
        // MM:SS.s format
        const [minutes, seconds] = parts
        return parseInt(minutes) * 60 + parseFloat(seconds)
      } else if (parts.length === 3) {
        // HH:MM:SS.s format
        const [hours, minutes, seconds] = parts
        return (
          parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds)
        )
      }
    }
    return 0
  }

  // Function to create YouTube URL with timestamp
  const createTimestampUrl = (timestamp: string, baseUrl: string): string => {
    const seconds = Math.floor(parseTimestamp(timestamp))
    const url = new URL(baseUrl)
    url.searchParams.set('t', `${seconds}s`)
    return url.toString()
  }

  // Function to render transcript text with clickable timestamp links
  const renderTranscriptText = (
    text: string,
    hasTimestamps: boolean,
    videoUrl: string
  ) => {
    if (!hasTimestamps || !text.includes('[')) {
      return (
        <div className='whitespace-pre-wrap text-gray-800 leading-relaxed'>
          {text}
        </div>
      )
    }

    // Split text by timestamp patterns and style them
    const parts = text.split(/(\[[^\]]+\])/g)

    return (
      <div className='whitespace-pre-wrap text-gray-800 leading-relaxed'>
        {parts.map((part, index) => {
          if (part.match(/^\[[^\]]+\]$/)) {
            // This is a timestamp - make it clickable
            const timestampUrl = createTimestampUrl(part, videoUrl)
            return (
              <a
                key={index}
                href={timestampUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 px-2 py-1 rounded text-sm font-mono mr-2 mb-1 cursor-pointer transition-colors duration-200 no-underline hover:shadow-sm'
                title={`Jump to ${part} in video`}
              >
                {part}
              </a>
            )
          } else {
            // This is regular text
            return <span key={index}>{part}</span>
          }
        })}
      </div>
    )
  }

  return (
    <main className='container mx-auto px-4 py-8 max-w-4xl min-w-[550px]'>
      <div className='text-right pt-[15px]'>
        <div className='text-right flex justify-between items-center'>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-white'>
            YouTube Transcriber
          </h1>
          <div>
            <Link
              href='/transcripts'
              className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-4 flex-shrink-0'
            >
              <button className='h-[50px] px-[22px] mr-[10px] border-none rounded-full cursor-pointer'>
                View Saved
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Service Selection - NOW WITH 3 OPTIONS */}
      <div className='mb-6 py-[15px]'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-[10px]'>
          Choose Transcription Service:
        </h3>
        <div className='flex flex-col gap-[5px]'>
          {/* YouTube Direct - Fastest */}
          <label className='flex items-center cursor-pointer block'>
            <input
              type='radio'
              name='service'
              value='youtube_direct'
              checked={selectedService === 'youtube_direct'}
              onChange={(e) =>
                setSelectedService(e.target.value as TranscriptService)
              }
              className='mr-[5px]'
            />
            <div className='flex flex-col'>
              <span className='font-medium text-gray-900 dark:text-white'>
                🚀 YouTube Direct API
                <span className='text-sm text-gray-500 dark:text-gray-400 ml-2'>
                  ~2-4 seconds (Fastest - optimized!)
                </span>
              </span>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                Extracts existing captions/transcripts directly from YouTube
              </span>
            </div>
          </label>

          {/* AssemblyAI Regular - Medium speed */}
          <label className='flex items-center cursor-pointer block'>
            <input
              type='radio'
              name='service'
              value='assemblyai'
              checked={selectedService === 'assemblyai'}
              onChange={(e) =>
                setSelectedService(e.target.value as TranscriptService)
              }
              className='mr-[5px]'
            />
            <div className='flex flex-col'>
              <span className='font-medium text-gray-900 dark:text-white'>
                🤖 AssemblyAI (Regular)
                <span className='text-sm text-gray-500 dark:text-gray-400 ml-2'>
                  ~30-120 seconds (Single file processing)
                </span>
              </span>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                AI-powered transcription, works with any video
              </span>
            </div>
          </label>

          {/* AssemblyAI Chunked - Fast parallel processing */}
          <label className='flex items-center cursor-pointer block'>
            <input
              type='radio'
              name='service'
              value='assemblyai_chunked'
              checked={selectedService === 'assemblyai_chunked'}
              onChange={(e) =>
                setSelectedService(e.target.value as TranscriptService)
              }
              className='mr-[5px]'
            />
            <div className='flex flex-col'>
              <span className='font-medium text-gray-900 dark:text-white'>
                ⚡ AssemblyAI with Chunking
                <span className='text-sm text-gray-500 dark:text-gray-400 ml-2'>
                  ~15-45 seconds (3x faster with parallel processing)
                </span>
              </span>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                Automatically splits long videos into chunks for parallel
                processing
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Timestamp Options - Only show for YouTube Direct */}
      {selectedService === 'youtube_direct' && (
        <div className='mb-6 py-[15px] bg-gray-50 dark:bg-gray-800 rounded-lg'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-[10px]'>
            Timestamp Options:
          </h3>
          <div className='space-y-3'>
            <label className='flex items-center cursor-pointer mb-[10px]'>
              <input
                type='checkbox'
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className='mr-[5px]'
              />
              <span className='text-gray-900 dark:text-white'>
                Include timestamps in transcript
              </span>
            </label>

            {includeTimestamps && (
              <div className='ml-6 space-y-2'>
                <div className='space-y-2 flex flex-col gap-[5px]'>
                  <label className='flex items-center cursor-pointer'>
                    <input
                      type='radio'
                      name='timestampFormat'
                      value='seconds'
                      checked={timestampFormat === 'seconds'}
                      onChange={(e) =>
                        setTimestampFormat(e.target.value as 'seconds')
                      }
                      className='mr-[5px]'
                    />
                    <span className='text-sm text-gray-900 dark:text-white'>
                      Seconds: [123.4s]
                    </span>
                  </label>
                  <label className='flex items-center cursor-pointer'>
                    <input
                      type='radio'
                      name='timestampFormat'
                      value='minutes'
                      checked={timestampFormat === 'minutes'}
                      onChange={(e) =>
                        setTimestampFormat(e.target.value as 'minutes')
                      }
                      className='mr-[5px]'
                    />
                    <span className='text-sm text-gray-900 dark:text-white'>
                      Minutes: [02:03.4]
                    </span>
                  </label>
                  <label className='flex items-center cursor-pointer'>
                    <input
                      type='radio'
                      name='timestampFormat'
                      value='timecode'
                      checked={timestampFormat === 'timecode'}
                      onChange={(e) =>
                        setTimestampFormat(e.target.value as 'timecode')
                      }
                      className='mr-[5px]'
                    />
                    <span className='text-sm text-gray-900 dark:text-white'>
                      Timecode: [01:02:03.4]
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className='mb-8 py-[15px]'>
        <div className='flex gap-4 flex-col'>
          <input
            type='url'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://www.youtube.com/watch?v=...'
            className='h-[50px] rounded-full border-[1px] outline-none px-[25px] mb-[10px] border-[#dddddd]'
            required
          />
          <button
            type='submit'
            disabled={loading}
            className='h-[50px] rounded-full border-none outline-none px-[15px] cursor-pointer bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
          >
            {loading
              ? `⏳ Processing with ${
                  selectedService === 'assemblyai'
                    ? 'AssemblyAI (Regular)'
                    : selectedService === 'assemblyai_chunked'
                    ? 'AssemblyAI (Chunked)'
                    : 'YouTube Direct'
                }...`
              : '🚀 Start Transcription'}
          </button>
        </div>
      </form>

      {error && (
        <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-600 dark:text-red-200'>
          {error}
        </div>
      )}

      {loading && (
        <div className='mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200'>
          <div className='flex items-center'>
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2'></div>
            <div>
              {selectedService === 'assemblyai' ? (
                <>
                  Processing video with regular AssemblyAI... This may take
                  several minutes for longer videos.
                  <br />
                  <span className='text-xs mt-1 block'>
                    Processing entire video as single file. For faster results,
                    try AssemblyAI with Chunking!
                  </span>
                </>
              ) : selectedService === 'assemblyai_chunked' ? (
                <>
                  Processing video with AssemblyAI Chunking Service... Much
                  faster with parallel processing!
                  <br />
                  <span className='text-xs mt-1 block'>
                    🚀 Videos are automatically split into chunks and processed
                    in parallel for 3x speed improvement.
                  </span>
                </>
              ) : (
                <>
                  Extracting transcript directly from YouTube... This should be
                  the fastest!
                  <br />
                  <span className='text-xs mt-1 block'>
                    {includeTimestamps
                      ? `Including timestamps in ${timestampFormat} format.`
                      : 'Only works with videos that have captions/transcripts available.'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {transcript && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 p-[15px]'>
          <div className='flex flex-col-reverse justify-between items-start mb-4'>
            <div className='flex-1'>
              <h2 className='text-2xl font-semibold text-gray-900 dark:text-white mb-[10px]'>
                {transcript.video_title || 'Transcript'}
              </h2>
              <div className='text-sm text-gray-600 dark:text-gray-400 mb-[15px]'>
                <div className='flex items-center gap-2 mb-2'>
                  <span className='font-medium'>Service:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      transcript.service_used === 'assemblyai'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : transcript.service_used === 'assemblyai_chunked'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}
                  >
                    {transcript.service_used === 'assemblyai'
                      ? 'AssemblyAI (Regular)'
                      : transcript.service_used === 'assemblyai_chunked'
                      ? 'AssemblyAI (Chunked)'
                      : 'YouTube Direct'}
                  </span>
                  {transcript.processing_time && (
                    <span className='px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>
                      ⚡ {transcript.processing_time.toFixed(1)}s
                    </span>
                  )}
                  {transcript.service_used === 'assemblyai_chunked' &&
                    transcript.total_chunks && (
                      <span className='px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'>
                        📦 {transcript.total_chunks} chunks
                      </span>
                    )}
                </div>
                <div className='flex flex-wrap gap-4 text-xs'>
                  <span>
                    Status:{' '}
                    <span className='font-medium'>{transcript.status}</span>
                  </span>
                  {transcript.audio_duration && (
                    <span>
                      Duration: {Math.round(transcript.audio_duration / 60)}{' '}
                      minutes
                    </span>
                  )}
                  {transcript.total_segments && (
                    <span>Segments: {transcript.total_segments}</span>
                  )}
                  {transcript.processing_time && (
                    <span>
                      Processing Time: {transcript.processing_time.toFixed(1)}s
                    </span>
                  )}
                  {transcript.include_timestamps &&
                    selectedService === 'youtube_direct' && (
                      <span>
                        <span
                          className={`px-1 py-0.5 rounded text-xs ${
                            transcript.has_timestamps
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {transcript.has_timestamps
                            ? `✓ ${transcript.timestamp_format} timestamps`
                            : '⚠ No timestamps detected'}
                        </span>
                      </span>
                    )}
                </div>

                {/* Chunking Performance Details */}
                {transcript.service_used === 'assemblyai_chunked' &&
                  transcript.chunks_info && (
                    <div className='mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                      <h4 className='text-sm font-semibold text-gray-900 dark:text-white mb-2'>
                        🚀 Chunking Performance Details
                      </h4>
                      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-xs'>
                        <div className='text-center'>
                          <div className='font-semibold text-green-600 dark:text-green-400'>
                            {
                              transcript.chunks_info.filter((c) => c.success)
                                .length
                            }
                          </div>
                          <div className='text-gray-500'>Successful</div>
                        </div>
                        <div className='text-center'>
                          <div className='font-semibold text-red-600 dark:text-red-400'>
                            {
                              transcript.chunks_info.filter((c) => !c.success)
                                .length
                            }
                          </div>
                          <div className='text-gray-500'>Failed</div>
                        </div>
                        <div className='text-center'>
                          <div className='font-semibold text-blue-600 dark:text-blue-400'>
                            {transcript.total_chunks}
                          </div>
                          <div className='text-gray-500'>Total Chunks</div>
                        </div>
                        <div className='text-center'>
                          <div className='font-semibold text-purple-600 dark:text-purple-400'>
                            {transcript.processing_time &&
                            transcript.audio_duration
                              ? Math.round(
                                  transcript.audio_duration /
                                    transcript.processing_time
                                )
                              : 0}
                            x
                          </div>
                          <div className='text-gray-500'>Speed Factor</div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
            <div className='flex gap-2 ml-4'>
              <button
                onClick={saveTranscript}
                disabled={saving || saved}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border-[#dddddd] border-[1px] rounded-full px-[14px] py-[4px] mb-[15px] cursor-pointer ${
                  saved
                    ? 'bg-green-600 text-white'
                    : saving
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Transcript'}
              </button>
            </div>
          </div>
          <div className='prose dark:prose-invert max-w-none'>
            {renderTranscriptText(
              transcript.text,
              transcript.has_timestamps || false,
              url
            )}
          </div>
        </div>
      )}
    </main>
  )
}
