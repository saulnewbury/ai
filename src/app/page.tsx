'use client'

import { useState } from 'react'
import Link from 'next/link'

interface TranscriptResult {
  text: string
  status: string
  audio_duration?: number
  video_title?: string
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTranscript(null)
    setSaved(false)

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
          audioDuration: transcript.audio_duration
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
      <div className='flex justify-between items-center mb-8'>
        <div className='text-center flex-1'>
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
        <Link
          href='/transcripts'
          className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-4 flex-shrink-0'
        >
          View Saved
        </Link>
      </div>

      <form onSubmit={handleSubmit} className='mb-8'>
        <div className='flex gap-4'>
          <input
            type='url'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://www.youtube.com/watch?v=...'
            className='flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white'
            required
          />
          <button
            type='submit'
            disabled={loading}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
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
            <div>
              Processing video... This may take several minutes for longer
              videos.
              <br />
              <span className='text-xs mt-1 block'>
                The app automatically selects lower quality audio for longer
                videos to ensure processing.
              </span>
            </div>
          </div>
        </div>
      )}

      {transcript && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6'>
          <div className='flex justify-between items-start mb-4'>
            <div className='flex-1'>
              <h2 className='text-2xl font-semibold text-gray-900 dark:text-white mb-2'>
                {transcript.video_title || 'Transcript'}
              </h2>
              <div className='text-sm text-gray-600 dark:text-gray-400'>
                Status: <span className='font-medium'>{transcript.status}</span>
                {transcript.audio_duration && (
                  <span className='ml-4'>
                    Duration: {Math.round(transcript.audio_duration / 60)}{' '}
                    minutes
                  </span>
                )}
              </div>
            </div>
            <div className='flex gap-2 ml-4'>
              <button
                onClick={saveTranscript}
                disabled={saving || saved}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
