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
      .order('lastMessageAt', { ascending: false, nullsFirst: false })
      .order('createdAt', { foreignTable: 'Message', ascending: false })
      .limit(1, { foreignTable: 'Message' })

    if (where.status) query = query.eq('status', where.status)
    if (where.assignedTo) query = query.eq('assignedTo', where.assignedTo)
    if (where.channelId) query = query.eq('channelId', where.channelId)

    // Filtro de Segurança / RBAC
    if (where.allowedChannelIds) {
      query = query.in('channelId', where.allowedChannelIds)
      
      if (where.currentUserId) {
        query = query.or(`assignedTo.eq.${where.currentUserId},assignedTo.is.null`)
      }
    }

    const { data, error } = await query
    if (error) throw error

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

  static async findActive(contactId: string, channelId: string) {
    const { data: conversation, error } = await supabaseAdmin
      .from('Conversation')
      .select('*')
      .eq('contactId', contactId)
      .eq('channelId', channelId)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return conversation
  }
}
