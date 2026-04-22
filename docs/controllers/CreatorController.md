# CreatorController

## Descrição

Controller das ações do **Creator**: validar e obter submissão em campanha, submeter campanha, listar campanhas submetidas, gerenciar carteiras, comentários em campanhas, perfil, transações, short URLs (criação e listagem), vencedores e recent earners.

## Base path

`/api/creator`

## Autenticação

- **optionalAuthGuard**: rotas que podem ser acessadas com ou sem token (ex.: campaign-winners, comments, campaign-short-urls).
- **creatorGuard**: rotas que exigem usuário autenticado tipo **CREATOR** (perfil, submissão, carteiras, short URLs criados pelo usuário, etc.).

## Serviço

- **CreatorService** (`src/services/CreatorService.ts`) e demais serviços utilizados pelos casos de uso (payments, campaigns, etc.).

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| GET | `/campaign-winners/:campaignId` | getCampaignWinners | Vencedores da campanha (optionalAuth) |
| GET | `/get-recent-earners` | getRecentEarners | Lista de recent earners (optionalAuth) |
| GET | `/campaign-short-urls/:campaignId` | getCampaignShortUrls | Short URLs da campanha (optionalAuth) |
| POST | `/comments` | insertComment | Inserir comentário (optionalAuth) |
| PUT | `/comments/:id` | updateComment | Atualizar comentário (optionalAuth) |
| DELETE | `/comments/:id` | deleteComment | Deletar comentário (optionalAuth) |
| GET | `/comments/:campaignId` | getComments | Listar comentários da campanha (optionalAuth) |
| POST | `/create-short-url/:campaignId` | createShortUrl | Criar short URL para a campanha (creator) |
| POST | `/create-shortener-kols/:campaignId` | createShortenerKols | Criar shortener KOLs (creator) |
| GET | `/get-shortener-kols/:campaignId` | getShortenerKols | Listar shortener KOLs da campanha (creator) |
| GET | `/profile` | getProfile | Perfil do creator logado |
| GET | `/welcome` | getTwitterInfo | Info Twitter (welcome) |
| PUT | `/update-description-profile` | updateDescriptionProfile | Atualizar descrição do perfil |
| GET | `/validate-submission-campaign/:campaignId` | validateSubmissionCampaign | Validar se pode submeter na campanha |
| GET | `/get-submission/:campaignId` | getCampaignSubmission | Obter submissão do creator na campanha |
| GET | `/get-shortener-user-campaign/:campaignId` | getShortenerUserCampaign | Short URL do usuário na campanha |
| POST | `/submit-campaign/:campaign_id` | submitCampaign | Submeter campanha |
| GET | `/campaigns-submitted` | getSubmittedCampaigns | Campanhas já submetidas pelo creator |
| GET | `/view-transactions-creator` | viewTransactionsCreator | Transações do creator |
| POST | `/insert-wallets` | insertWallets | Inserir carteiras (EVM, SUI, SOL) |
| DELETE | `/delete-wallet/:walletType` | deleteWallet | Remover uma carteira por tipo |
