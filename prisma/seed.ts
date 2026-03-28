import 'dotenv/config'
import { PrismaClient, UserRole, ConversationStatus, SenderType, MessageType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('❌ ERRO: DATABASE_URL não encontrada no ambiente.')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Iniciando seed...')

  // 1. Limpar banco (opcional, mas bom para desenvolvimento limpo)
  // Ordem reversa de dependência
  await prisma.internalNote.deleteMany()
  await prisma.message.deleteMany()
  await prisma.conversationTag.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.userChannel.deleteMany()
  await prisma.quickReply.deleteMany()
  await prisma.keywordSuggestion.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.channel.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.user.deleteMany()

  // 2. Criar Usuários
  const admin = await prisma.user.create({
    data: {
      name: 'Diretor Geral',
      email: 'admin@faculdade.edu.br',
      role: UserRole.ADMIN,
    }
  })

  const supervisor = await prisma.user.create({
    data: {
      name: 'Supervisor de Atendimento',
      email: 'supervisor@faculdade.edu.br',
      role: UserRole.SUPERVISOR,
    }
  })

  const agent1 = await prisma.user.create({
    data: { name: 'Ana Comercial', email: 'ana@faculdade.edu.br', role: UserRole.AGENT }
  })
  const agent2 = await prisma.user.create({
    data: { name: 'Bruno Financeiro', email: 'bruno@faculdade.edu.br', role: UserRole.AGENT }
  })
  const agent3 = await prisma.user.create({
    data: { name: 'Carlos Secretaria', email: 'carlos@faculdade.edu.br', role: UserRole.AGENT }
  })

  // 3. Criar Canais
  const canalComercial = await prisma.channel.create({
    data: { name: 'WhatsApp Comercial', phoneNumber: '+5511911111111', isActive: true }
  })
  const canalFinanceiro = await prisma.channel.create({
    data: { name: 'WhatsApp Financeiro', phoneNumber: '+5511922222222', isActive: true }
  })
  const canalSecretaria = await prisma.channel.create({
    data: { name: 'WhatsApp Secretaria', phoneNumber: '+5511933333333', isActive: true }
  })

  // 4. Vínculos Usuário-Canal
  await prisma.userChannel.createMany({
    data: [
      { userId: agent1.id, channelId: canalComercial.id },
      { userId: agent2.id, channelId: canalFinanceiro.id },
      { userId: agent3.id, channelId: canalSecretaria.id },
      { userId: supervisor.id, channelId: canalComercial.id },
      { userId: supervisor.id, channelId: canalFinanceiro.id },
      { userId: supervisor.id, channelId: canalSecretaria.id },
    ]
  })

  // 5. Criar Tags
  const tagNovo = await prisma.tag.create({ data: { name: 'Novo Lead', color: '#3b82f6' } })
  const tagMatricula = await prisma.tag.create({ data: { name: 'Em Matrícula', color: '#10b981' } })
  const tagUrgente = await prisma.tag.create({ data: { name: 'Urgente', color: '#ef4444' } })
  const tagFinanceiro = await prisma.tag.create({ data: { name: 'Financeiro Pendente', color: '#f59e0b' } })

  // 6. Criar Respostas Rápidas
  await prisma.quickReply.createMany({
    data: [
      { title: 'Saudação Geral', content: 'Olá! Bem-vindo à Faculdade Motiva. Como podemos te ajudar hoje?', category: 'Geral' },
      { title: 'PIX Pagamento', content: 'Nossa chave PIX é financeiro@faculdade.edu.br. Por favor, envie o comprovante após o pagamento.', category: 'Financeiro', channelId: canalFinanceiro.id },
      { title: 'Documentos Matrícula', content: 'Para a matrícula, precisamos de: RG, CPF, Histórico Escolar e Comprovante de Residência.', category: 'Secretaria', channelId: canalSecretaria.id },
      { title: 'Horário de Prova', content: 'O vestibular acontece todos os sábados às 09:00 no Bloco A.', category: 'Comercial' },
    ]
  })

  // 7. Criar Sugestões de Palavras-Chave
  await prisma.keywordSuggestion.createMany({
    data: [
      { 
        keyword: 'Vestibular', 
        triggers: ['vestibular', 'prova', 'ingresso', 'entrar'], 
        response: 'As inscrições para o vestibular estão abertas! Você pode se inscrever pelo site ou vir direto na faculdade.', 
        category: 'Comercial' 
      },
      { 
        keyword: 'Boleto', 
        triggers: ['boleto', 'mensalidade', 'pagar', 'vencimento', 'pago'], 
        response: 'Para visualizar seus boletos, você pode acessar o Portal do Aluno em aluno.faculdade.edu.br.', 
        category: 'Financeiro' 
      },
      { 
        keyword: 'Transferência', 
        triggers: ['transferencia', 'mudar', 'vinculo'], 
        response: 'Para transferências externas, precisamos do seu histórico e ementas das matérias já cursadas.', 
        category: 'Secretaria' 
      },
    ]
  })

  // 8. Criar Contatos e Conversas
  const contatosData = [
    { name: 'Ricardo Aluno', phone: '+5511999990001' },
    { name: 'Fernanda Candidata', phone: '+5511999990002' },
    { name: 'Lucas Medicina', phone: '+5511999990003' },
    { name: 'Juliana Direito', phone: '+5511999990004' },
    { name: 'Marcos Financeiro', phone: '+5511999990005' },
    { name: 'Beatriz Transferência', phone: '+5511999990006' },
    { name: 'Gabriel Pós-graduação', phone: '+5511999990007' },
    { name: 'Letícia Veterana', phone: '+5511999990008' },
    { name: 'Daniel Inadimplente', phone: '+5511999990009' },
    { name: 'Paula Egresso', phone: '+5511999990010' },
    { name: 'Roberto EAD', phone: '+5511999990011' },
    { name: 'Sarah Mestrado', phone: '+5511999990012' },
  ]

  for (let i = 0; i < contatosData.length; i++) {
    const contato = await prisma.contact.create({ data: contatosData[i] })
    
    // Distribuição de canais (simples rotatividade)
    let canalSelected = canalComercial
    if (i % 3 === 1) canalSelected = canalFinanceiro
    if (i % 3 === 2) canalSelected = canalSecretaria

    const conv = await prisma.conversation.create({
      data: {
        contactId: contato.id,
        channelId: canalSelected.id,
        status: i % 2 === 0 ? ConversationStatus.IN_PROGRESS : ConversationStatus.OPEN,
        assignedTo: i % 2 === 0 ? (i % 4 === 0 ? agent1.id : agent2.id) : null
      }
    })

    // Adicionar Tag Aleatória
    if (i % 4 === 0) {
      await prisma.conversationTag.create({ data: { conversationId: conv.id, tagId: tagMatricula.id } })
    }

    // Criar Mensagens de exemplo
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        channelId: canalSelected.id,
        senderType: SenderType.USER,
        content: `Olá, gostaria de saber mais sobre ${i % 3 === 0 ? 'o vestibular' : i % 3 === 1 ? 'o boleto vencido' : 'o diploma'}.`,
        type: MessageType.TEXT
      }
    })

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        channelId: canalSelected.id,
        senderType: SenderType.AGENT,
        content: `Oi ${contato.name}, tudo bem? Claro! Vou te ajudar com isso agora mesmo.`,
        type: MessageType.TEXT
      }
    })
    
    if (i % 3 === 0) {
       await prisma.message.create({
        data: {
          conversationId: conv.id,
          channelId: canalSelected.id,
          senderType: SenderType.USER,
          content: `Legal! Qual o prazo?`,
          type: MessageType.TEXT
        }
      })
    }
  }

  console.log('✅ Seed finalizado com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
