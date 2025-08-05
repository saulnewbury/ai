'use client'

import { useState } from 'react'

interface TranscriptResult {
  text: string
  status: string
  audio_duration?: number
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTranscript(null)

    try {
      const response = await fetch('/api/transcribe', {
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
          throw new Error(
            'AssemblyAI service is temporarily unavailable. Please try again in a few minutes.'
          )
        } else if (response.status >= 500) {
          throw new Error('Server error occurred. Please try again.')
        } else {
          throw new Error(data.error || 'Failed to transcribe video')
        }
      }

      setTranscript(data)
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

  return (
    <main className='container mx-auto px-4 py-8 max-w-4xl'>
      <div className='text-center mb-8'>
        <h1 className='text-4xl font-bold text-gray-900 dark:text-white mb-4'>
          YouTube Transcriber
        </h1>
        <p className='text-lg text-gray-600 dark:text-gray-400 mb-2'>
          Enter a YouTube URL to generate a transcript using AssemblyAI
        </p>
        <p className='text-sm text-gray-500 dark:text-gray-500'>
          ⚡ Works best with videos under 30 minutes • Longer videos may take
          more time
        </p>
      </div>

      <form onSubmit={handleSubmit} className='mb-8'>
        <div className='flex gap-24 flex-col'>
          <input
            type='url'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://www.youtube.com/watch?v=...'
            className='mb-[10px] flex-1 p-[20px] rounded-full border-[1px] focus:outline-0'
            required
          />
          <button
            type='submit'
            disabled={loading}
            className='p-[20px] rounded-full border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ce3939] hover:text-[white]'
          >
            {loading ? 'Transcribing...' : 'Transcribe'}
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
            Processing video... This may take several minutes for longer videos.
            <br />
            <span className='text-xs mt-1 block'>
              The app automatically selects lower quality audio for longer
              videos to ensure processing.
            </span>
          </div>
        </div>
      )}

      {transcript && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6'>
          <div className='mb-4'>
            <h2 className='text-2xl font-semibold text-gray-900 dark:text-white mb-2'>
              Transcript
            </h2>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Status: <span className='font-medium'>{transcript.status}</span>
              {transcript.audio_duration && (
                <span className='ml-4'>
                  Duration: {Math.round(transcript.audio_duration / 60)} minutes
                </span>
              )}
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
