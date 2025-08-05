'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface SavedTranscript {
  id: string
  videoTitle: string
  videoUrl: string
  text: string
  audioDuration?: number
  createdAt: string
  updatedAt: string
}

export default function TranscriptDetailPage() {
  const params = useParams()
  const [transcript, setTranscript] = useState<SavedTranscript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchTranscript(params.id as string)
    }
  }, [params.id])

  const fetchTranscript = async (id: string) => {
    try {
      const response = await fetch(`/api/transcripts/${id}`)
      if (response.ok) {
        const data = await response.json()
        setTranscript(data)
      } else {
        setError('Transcript not found')
      }
    } catch (err) {
      setError('Error loading transcript')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!transcript) return

    try {
      await navigator.clipboard.writeText(transcript.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('Failed to copy to clipboard')
    }
  }

  const downloadTranscript = () => {
    if (!transcript) return

    const content = `Title: ${transcript.videoTitle}\nURL: ${
      transcript.videoUrl
    }\nDate: ${new Date(transcript.createdAt).toLocaleString()}\n\n${
      transcript.text
    }`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${transcript.videoTitle
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return (
      date.toLocaleDateString() +
      ' at ' +
      date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    )
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const minutes = Math.round(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes} minutes`
  }

  if (loading) {
    return (
      <main className='container mx-auto px-4 py-8 max-w-4xl'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-2 text-gray-600 dark:text-gray-400'>
            Loading transcript...
          </p>
        </div>
      </main>
    )
  }

  if (error || !transcript) {
    return (
      <main className='container mx-auto px-4 py-8 max-w-4xl'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>
            Transcript Not Found
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mb-6'>
            {error || 'The transcript you are looking for does not exist.'}
          </p>
          <Link
            href='/transcripts'
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Back to Transcripts
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className='container mx-auto px-4 py-8 max-w-4xl p-[15px]'>
      <div className='mb-[10px]'>
        <Link
          href='/transcripts'
          className='text-blue-600 dark:text-blue-400 hover:underline text-sm'
        >
          ← Back to Transcripts
        </Link>
      </div>

      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6'>
        <div className='border-b border-gray-200 dark:border-gray-600 pb-[15px] mb-6'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-4 mb-[10px]'>
            {transcript.videoTitle}
          </h1>

          <div className='flex flex-wrap items-center gap-4 text-sm text-[#888888] dark:text-gray-400 mb-4 mb-[10px]'>
            <span>Duration: {formatDuration(transcript.audioDuration)}</span>
            <span className='px-[5px]'>•</span>
            <span>Transcribed: {formatDate(transcript.createdAt)}</span>
          </div>

          <div className='flex justify-between items-center gap-3 mb-4'>
            <a
              href={transcript.videoUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm'
            >
              View source
            </a>
            <div>
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 mr-[5px] rounded-lg text-sm transition-colors cursor-pointer border-[#dddddd] border-[1px] rounded-full px-[14px] py-[4px] ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
              <button
                onClick={downloadTranscript}
                className='px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm cursor-pointer border-[#dddddd] border-[1px] rounded-full px-[14px] py-[4px]'
              >
                Download
              </button>
            </div>
          </div>
        </div>

        <div className='prose dark:prose-invert max-w-none pt-[15px]'>
          <div className='whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed text-lg'>
            {transcript.text}
          </div>
        </div>
      </div>
    </main>
  )
}
