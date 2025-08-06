'use client'

import { useState } from 'react'
import Link from 'next/link'

interface TranscriptResult {
  text: string
  status: string
  audio_duration?: number
  video_title?: string
  service_used?: 'assemblyai' | 'scrape_creators'
}

type TranscriptService = 'assemblyai' | 'scrape_creators' | 'youtube_direct'

export default function Home() {
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedService, setSelectedService] =
    useState<TranscriptService>('youtube_direct')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTranscript(null)
    setSaved(false)

    try {
      let endpoint: string
      if (selectedService === 'assemblyai') {
        endpoint = '/api/transcribe'
      } else if (selectedService === 'scrape_creators') {
        endpoint = '/api/transcribe-scrape'
      } else {
        endpoint = '/api/transcribe-youtube'
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle different types of errors
        if (response.status === 503) {
          const serviceName =
            selectedService === 'assemblyai'
              ? 'AssemblyAI'
              : selectedService === 'scrape_creators'
              ? 'Scrape Creators'
              : 'YouTube Direct'
          throw new Error(
            `${serviceName} service is temporarily unavailable. Please try again in a few minutes.`
          )
        } else if (response.status >= 500) {
          throw new Error('Server error occurred. Please try again.')
        } else {
          throw new Error(data.error || 'Failed to transcribe video')
        }
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

  return (
    <main className='container mx-auto px-4 py-8 max-w-4xl'>
      <div className='text-right pt-[15px]'>
        <button className='border-[#dddddd] border-[1px] rounded-full px-[14px] py-[4px] text-black'>
          <Link
            href='/transcripts'
            className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-4 flex-shrink-0'
          >
            View Saved
          </Link>
        </button>
      </div>
      <div className='flex justify-between items-center mb-8 p-[15px]'>
        <div className='text-center flex-1'>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-white mb-[15px]'>
            YouTube Transcriber
          </h1>
          <p className='text-lg text-gray-600 dark:text-gray-400 mb-2'>
            Enter a YouTube URL to generate a transcript
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-500'>
            ⚡ Works best with videos under 30 minutes
          </p>
        </div>
      </div>

      {/* Service Selection */}
      <div className='mb-6 p-[15px]'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-3'>
          Choose Transcription Service:
        </h3>
        <div className='flex gap-4 flex-wrap'>
          <label className='flex items-center cursor-pointer'>
            <input
              type='radio'
              name='service'
              value='youtube_direct'
              checked={selectedService === 'youtube_direct'}
              onChange={(e) =>
                setSelectedService(e.target.value as TranscriptService)
              }
              className='mr-2'
            />
            <div className='flex flex-col'>
              <span className='font-medium text-gray-900 dark:text-white'>
                YouTube Direct ⚡
              </span>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Fastest (~2-3 seconds), extracts existing captions
              </span>
            </div>
          </label>
          <label className='flex items-center cursor-pointer'>
            <input
              type='radio'
              name='service'
              value='assemblyai'
              checked={selectedService === 'assemblyai'}
              onChange={(e) =>
                setSelectedService(e.target.value as TranscriptService)
              }
              className='mr-2'
            />
            <div className='flex flex-col'>
              <span className='font-medium text-gray-900 dark:text-white'>
                AssemblyAI
              </span>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                High accuracy, AI-powered transcription (slower)
              </span>
            </div>
          </label>
          <label className='flex items-center cursor-pointer'>
            <input
              type='radio'
              name='service'
              value='scrape_creators'
              checked={selectedService === 'scrape_creators'}
              onChange={(e) =>
                setSelectedService(e.target.value as TranscriptService)
              }
              className='mr-2'
            />
            <div className='flex flex-col'>
              <span className='font-medium text-gray-900 dark:text-white'>
                Scrape Creators
              </span>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Caption extraction via API (medium speed)
              </span>
            </div>
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit} className='mb-8 p-[15px]'>
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
              ? `Transcribing with ${
                  selectedService === 'assemblyai'
                    ? 'AssemblyAI'
                    : selectedService === 'scrape_creators'
                    ? 'Scrape Creators'
                    : 'YouTube Direct'
                }...`
              : 'Transcribe'}
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
                  Processing video with AssemblyAI... This may take several
                  minutes for longer videos.
                  <br />
                  <span className='text-xs mt-1 block'>
                    The app automatically selects lower quality audio for longer
                    videos to ensure processing.
                  </span>
                </>
              ) : selectedService === 'scrape_creators' ? (
                <>
                  Extracting transcript with Scrape Creators... This usually
                  takes 10-20 seconds.
                  <br />
                  <span className='text-xs mt-1 block'>
                    Note: This method requires existing captions on the video.
                  </span>
                </>
              ) : (
                <>
                  Extracting transcript directly from YouTube... This is the
                  fastest method.
                  <br />
                  <span className='text-xs mt-1 block'>
                    Note: Only works with videos that have captions/transcripts
                    available.
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
                        : transcript.service_used === 'scrape_creators'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}
                  >
                    {transcript.service_used === 'assemblyai'
                      ? 'AssemblyAI'
                      : transcript.service_used === 'scrape_creators'
                      ? 'Scrape Creators'
                      : 'YouTube Direct'}
                  </span>
                </div>
                <div>
                  Status:{' '}
                  <span className='font-medium'>{transcript.status}</span>
                  {transcript.audio_duration && (
                    <span className='ml-4 block'>
                      Duration: {Math.round(transcript.audio_duration / 60)}{' '}
                      minutes
                    </span>
                  )}
                </div>
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
            <div className='whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed'>
              {transcript.text}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
