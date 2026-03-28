import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ConversationRepository {
  static async findMany(where: any) {
    let query = supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        tags:ConversationTag(*, tag:Tag(*)),
        messages:Message(*)
      `)
      .order('createdAt', { ascending: false })

    if (where.status) query = query.eq('status', where.status)
    if (where.assignedTo) query = query.eq('assignedTo', where.assignedTo)
    if (where.channelId) query = query.eq('channelId', where.channelId)

    const { data, error } = await query
    if (error) throw error

    // Post-process messages to mirror Prisma 'take: 1' if needed
    // or just return data as is if the frontend handles it.
    return data
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        tags:ConversationTag(*, tag:Tag(*))
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newConversation, error } = await supabaseAdmin
      .from('Conversation')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()

    if (error) throw error
    return newConversation
  }

  static async update(id: string, data: any) {
    const { data: updatedConversation, error } = await supabaseAdmin
      .from('Conversation')
      .update(data)
      .eq('id', id)
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*)
      `)
      .single()

    if (error) throw error
    return updatedConversation
  }
}
