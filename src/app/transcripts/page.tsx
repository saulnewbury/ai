'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface SavedTranscript {
  id: string
  videoTitle: string
  videoUrl: string
  text: string
  audioDuration?: number
  createdAt: string
  updatedAt: string
}

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<SavedTranscript[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTranscripts()
  }, [])

  const fetchTranscripts = async () => {
    try {
      const response = await fetch('/api/transcripts')
      if (response.ok) {
        const data = await response.json()
        setTranscripts(data)
      } else {
        setError('Failed to load transcripts')
      }
    } catch (err) {
      setError('Error loading transcripts')
    } finally {
      setLoading(false)
    }
  }

  const deleteTranscript = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transcript?')) {
      return
    }

    try {
      const response = await fetch(`/api/transcripts?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTranscripts(transcripts.filter((t) => t.id !== id))
      } else {
        alert('Failed to delete transcript')
      }
    } catch (err) {
      alert('Error deleting transcript')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    )
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const minutes = Math.round(seconds / 60)
    return `${minutes} min`
  }

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <main className='container mx-auto px-4 py-8 max-w-6xl'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-2 text-gray-600 dark:text-gray-400'>
            Loading transcripts...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className='container mx-auto px-4 py-8 max-w-6xl'>
      <div className='flex justify-between items-center mb-8 p-[15px]'>
        <div>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-white mb-2'>
            Saved Transcripts
          </h1>
          <p className='text-gray-600 dark:text-gray-400'>
            {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}{' '}
            saved
          </p>
        </div>
        <Link
          href='/'
          className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[black]'
        >
          New Transcript &gt;
        </Link>
      </div>

      {error && (
        <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-600 dark:text-red-200'>
          {error}
        </div>
      )}

      {transcripts.length === 0 ? (
        <div className='text-center py-12'>
          <div className='text-gray-400 dark:text-gray-600 mb-4'>
            <svg
              className='mx-auto h-12 w-12'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
          </div>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
            No transcripts yet
          </h3>
          <p className='text-gray-500 dark:text-gray-400 mb-4'>
            Start by creating your first transcript from a YouTube video.
          </p>
          <Link
            href='/'
            className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Create Transcript
          </Link>
        </div>
      ) : (
        <div className='grid gap-[10px] p-[15px]'>
          {transcripts.map((transcript) => (
            <div
              key={transcript.id}
              className='bg-white dark:bg-gray-800 rounded-[15px] p-[15px] shadow-lg p-6 border border-[#dddddd] dark:border-gray-700'
            >
              <div className='flex justify-between items-start'>
                <div className='flex-1'>
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-white mb-[10px] mr-[10px]'>
                    {transcript.videoTitle}
                  </h3>

                  <div className=''>
                    <p className='text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-[10px]'>
                      {truncateText(transcript.text)}
                    </p>
                  </div>

                  <div className='flex items-center gap-4 text-sm text-[#999999] mb-[10px]'>
                    <span>{formatDate(transcript.createdAt)}</span>
                    <span className='px-[5px]'>•</span>
                    <span>
                      Duration: {formatDuration(transcript.audioDuration)}
                    </span>
                  </div>
                  <a
                    href={transcript.videoUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-600 dark:text-blue-400 hover:underline text-sm'
                  >
                    Source video
                  </a>
                </div>
                <div className='flex gap-2 ml-4'>
                  <button className='w-[4rem] cursor-pointer py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors mr-[5px] border-[#dddddd] border-[1px] rounded-full px-[14px] py-[4px]'>
                    <Link
                      href={`/transcripts/${transcript.id}`}
                      className='bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors'
                    >
                      View
                    </Link>
                  </button>
                  <button
                    onClick={() => deleteTranscript(transcript.id)}
                    className='w-[4rem] cursor-pointer py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors border-[#dddddd] border-[1px] rounded-full px-[14px] py-[4px]'
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
