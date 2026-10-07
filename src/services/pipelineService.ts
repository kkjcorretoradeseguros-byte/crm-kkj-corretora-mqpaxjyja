import pb from '@/lib/pocketbase/client'
import type { PipelineStage, PipelineEntry } from '@/types/crm'

export const pipelineService = {
  async getStages() {
    return await pb.collection('pipeline_stages').getFullList<PipelineStage>({
      sort: 'position',
    })
  },

  async createStage(data: { name: string; position: number; color?: string }) {
    return await pb.collection('pipeline_stages').create<PipelineStage>(data)
  },

  async updateStage(id: string, data: Partial<PipelineStage>) {
    return await pb.collection('pipeline_stages').update<PipelineStage>(id, data)
  },

  async deleteStage(id: string) {
    return await pb.collection('pipeline_stages').delete(id)
  },

  async getEntries() {
    return await pb.collection('pipeline_entries').getFullList<PipelineEntry>({
      sort: '-created',
      expand: 'stage_id,client_id,property_id',
    })
  },

  async createEntry(data: {
    stage_id: string
    client_id: string
    property_id?: string
    value?: number
    notes?: string
  }) {
    return await pb.collection('pipeline_entries').create<PipelineEntry>(data, {
      expand: 'stage_id,client_id,property_id',
    })
  },

  async updateEntryStage(id: string, stage_id: string) {
    return await pb
      .collection('pipeline_entries')
      .update<PipelineEntry>(id, { stage_id }, { expand: 'stage_id,client_id,property_id' })
  },

  async updateEntry(id: string, data: Partial<PipelineEntry>) {
    return await pb.collection('pipeline_entries').update<PipelineEntry>(id, data, {
      expand: 'stage_id,client_id,property_id',
    })
  },

  async deleteEntry(id: string) {
    return await pb.collection('pipeline_entries').delete(id)
  },
}
