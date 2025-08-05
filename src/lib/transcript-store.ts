import fs from 'fs'
import path from 'path'

export interface SavedTranscript {
  id: string
  videoTitle: string
  videoUrl: string
  text: string
  audioDuration?: number
  createdAt: Date
  updatedAt: Date
}

const DATA_FILE = path.join(process.cwd(), 'data', 'transcripts.json')

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Read transcripts from file
function readTranscripts(): SavedTranscript[] {
  ensureDataDir()

  if (!fs.existsSync(DATA_FILE)) {
    return []
  }

  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8')
    const transcripts = JSON.parse(data)

    // Convert date strings back to Date objects
    return transcripts.map((t: any) => ({
      ...t,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt)
    }))
  } catch (error) {
    console.error('Error reading transcripts file:', error)
    return []
  }
}

// Write transcripts to file
function writeTranscripts(transcripts: SavedTranscript[]) {
  ensureDataDir()

  try {
    const data = JSON.stringify(transcripts, null, 2)
    fs.writeFileSync(DATA_FILE, data, 'utf-8')
  } catch (error) {
    console.error('Error writing transcripts file:', error)
    throw error
  }
}

class FileTranscriptStore {
  save(
    transcript: Omit<SavedTranscript, 'id' | 'createdAt' | 'updatedAt'>
  ): SavedTranscript {
    const transcripts = readTranscripts()
    const now = new Date()

    const savedTranscript: SavedTranscript = {
      ...transcript,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    }

    transcripts.unshift(savedTranscript) // Add to beginning
    writeTranscripts(transcripts)

    return savedTranscript
  }

  getAll(): SavedTranscript[] {
    return readTranscripts()
  }

  getById(id: string): SavedTranscript | null {
    const transcripts = readTranscripts()
    return transcripts.find((t) => t.id === id) || null
  }

  delete(id: string): boolean {
    const transcripts = readTranscripts()
    const index = transcripts.findIndex((t) => t.id === id)

    if (index !== -1) {
      transcripts.splice(index, 1)
      writeTranscripts(transcripts)
      return true
    }

    return false
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  }
}

export const transcriptStore = new FileTranscriptStore()
