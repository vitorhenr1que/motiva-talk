import prisma from '@/lib/prisma';
import { WebhookEvent } from './provider';

export class WebhookIngestionService {
  /**
   * Main entry point for ingesting incoming messages from WhatsApp.
   */
  static async ingestMessage(event: WebhookEvent) {
    const { channelId, senderPhone, senderName, content, messageType, metadata } = event;
    const externalMessageId = metadata?.key?.id;

    if (!senderPhone || !content) {
      console.warn('Skipping message ingestion: missing senderPhone or content');
      return;
    }

    try {
      // 1. Identify Channel by its ID or its providerSessionId
      const channel = await prisma.channel.findFirst({
        where: {
          OR: [
            { id: channelId },
            { providerSessionId: channelId }
          ]
        }
      });

      if (!channel) {
        console.error(`Channel with ID ${channelId} not found for message ingestion.`);
        return;
      }

      // 2. Deduplicate: Check if message already exists
      if (externalMessageId) {
        const existing = await prisma.message.findUnique({
          where: { externalMessageId }
        });
        if (existing) {
          console.log(`Duplicate message ${externalMessageId} ignored.`);
          return;
        }
      }

      // 3. Identify or Create Contact
      const contact = await prisma.contact.upsert({
        where: { phone: senderPhone },
        update: { name: senderName || senderPhone }, // Update name if provided
        create: {
          phone: senderPhone,
          name: senderName || senderPhone
        }
      });

      // 4. Identify or Create Open Conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          channelId: channel.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            contactId: contact.id,
            channelId: channel.id,
            status: 'OPEN',
            lastMessageAt: new Date() // Using current time
          }
        });
      }

      // 5. Save Message
      const newMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          channelId: channel.id,
          senderType: 'USER',
          content: content,
          type: messageType || 'TEXT',
          externalMessageId: externalMessageId,
        }
      });

      // 6. Update Conversation lastActivity
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });

      // 7. Success & Realtime Notification
      console.log(`Message from ${senderPhone} ingested successfully into conversation ${conversation.id}`);
      
      const { RealtimeService } = await import('@/services/realtime.service');
      await RealtimeService.notifyNewMessage(conversation.id, newMessage);

      return { conversation, message: newMessage };

    } catch (error) {
      console.error('CRITICAL: Message ingestion failed:', error);
      throw error;
    }
  }
}
