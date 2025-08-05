export interface SavedTranscript {
  id: string
  videoTitle: string
  videoUrl: string
  text: string
  audioDuration?: number
  createdAt: Date
  updatedAt: Date
}

// In-memory storage (in a real app, you'd use a database)
class TranscriptStore {
  private transcripts: SavedTranscript[] = []

  save(
    transcript: Omit<SavedTranscript, 'id' | 'createdAt' | 'updatedAt'>
  ): SavedTranscript {
    const now = new Date()
    const savedTranscript: SavedTranscript = {
      ...transcript,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    }

    this.transcripts.unshift(savedTranscript) // Add to beginning
    return savedTranscript
  }

  getAll(): SavedTranscript[] {
    return [...this.transcripts] // Return copy
  }

  getById(id: string): SavedTranscript | null {
    return this.transcripts.find((t) => t.id === id) || null
  }

  delete(id: string): boolean {
    const index = this.transcripts.findIndex((t) => t.id === id)
    if (index !== -1) {
      this.transcripts.splice(index, 1)
      return true
    }
    return false
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  }
}

export const transcriptStore = new TranscriptStore()
