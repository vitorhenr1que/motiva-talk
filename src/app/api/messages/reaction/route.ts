import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';

export async function POST(req: Request) {
  try {
    const { messageId, emoji } = await req.json();

    if (!messageId || !emoji) {
      return NextResponse.json({ error: 'Message ID e Emoji são obrigatórios.' }, { status: 400 });
    }

    // 1. Busca os dados da mensagem no banco para obter o externalId e o canal
    const { data: message, error: msgError } = await supabase
      .from('Message')
      .select('*, conversation:Conversation(*, channel:Channel(*))')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      console.error('[REACTION_API] Mensagem não encontrada:', msgError);
      return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 });
    }

    const conversation = message.conversation;
    const channel = conversation?.channel;
    const externalId = message.metadata?.externalId || message.externalMessageId;
    const fromMe = message.fromMe ?? (message.senderType === 'AGENT');
    const recipient = conversation.contactPhone;

    if (!channel || !externalId || !recipient) {
      console.error('[REACTION_API] Dados insuficientes:', { channel: !!channel, externalId, recipient });
      return NextResponse.json({ error: 'Dados insuficientes para enviar a reação.' }, { status: 400 });
    }

    // 2. Envia a reação via Evolution API
    console.log(`[REACTION_API] Enviando reação "${emoji}" para a mensagem ${externalId}`);
    const result = await evolutionProvider.sendReaction(
      channel,
      recipient,
      externalId,
      fromMe,
      emoji
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[REACTION_API] Erro crítico:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
