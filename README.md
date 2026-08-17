# Motiva Talk

Central interna de atendimento multicanal para uma única organização. Esta edição é standalone: não possui cadastro público, planos, cobrança, cotas de uso ou painel de administração SaaS.

## Funcionalidades

- Caixa de entrada do WhatsApp com mídia, templates e respostas rápidas
- Contatos, etiquetas, setores e transferência de atendimentos
- Funil Kanban, relatórios, avaliações e sugestões
- Gestão de usuários e permissões da equipe
- Conexão exclusiva pela API oficial do WhatsApp Business (Meta Cloud API)
- Supabase para autenticação, dados, realtime e arquivos

## Desenvolvimento

Copie `.env.example` para `.env` e configure o Supabase e a Meta Cloud API. O token permanente da Meta deve existir apenas no servidor. Os usuários são criados por um administrador ou por convite interno; não há autocadastro.

Esta instalação começa com o número `+55 75 98104-8077` e aceita novos canais pertencentes à mesma empresa. Cada número deve ser cadastrado no WhatsApp Manager e operar exclusivamente pela Cloud API. Antes do cadastro, remova o número do aplicativo WhatsApp Business. Depois da validação por SMS ou ligação, informe o `Phone Number ID` e o `WABA ID` na tela do canal; mantenha `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET` somente no servidor.

Depois, instale as dependências e inicie o servidor:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O onboarding de canais exige autenticação e pode ser acessado em `/onboarding`.

## Verificação

```bash
npm run lint
npm run build
```
