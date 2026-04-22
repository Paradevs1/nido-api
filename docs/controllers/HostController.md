# HostController

## Descrição

Controller das ações do **Host**: listar e criar campanhas, editar e excluir campanha, leaderboard e vencedores, definir vencedores, perfil, contagem de campanhas, rank Twitter, info de post do creator, conta ativa, reenvio e validação de código de email, comentário fixo e listagem de KOLs.

## Base path

`/api/host`

## Autenticação

- **authenticatedUserGuard**: apenas usuário autenticado (ex.: listagem pública de campanhas).
- **optionalAuthGuard**: rotas que aceitam com ou sem token (ex.: resend/validate email code, get campaign by id).
- **hostGuard**: rotas que exigem usuário tipo **HOST** (perfil, campanhas do host, criar/editar/deletar, leaderboard, winners, etc.).

## Serviço

- **HostService** (`src/services/HostService.ts`) e **CampaignModel**, **UserModel**, etc.

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| GET | `/campaigns/public` | getAllCampaigns | Listar todas as campanhas públicas (authenticatedUser) |
| GET | `/campaigns/:id` | getCampaignById | Detalhe da campanha por ID (optionalAuth) |
| GET | `/campaigns/:id/get-campaign-tiers` | getCampaignTiers | Tiers da campanha (optionalAuth) |
| POST | `/resend-verification-code` | resendVerificationCode | Reenviar código de verificação (optionalAuth) |
| POST | `/validate-email-code` | validateEmailCode | Validar código de email (optionalAuth) |
| GET | `/active-account` | HostActiveAccount | Verificar/conta ativa do host |
| GET | `/profile` | getProfile | Perfil do host logado |
| GET | `/is-parabuilders` | isParabuilders | Verificar se é Parabuilders |
| PUT | `/update-profile` | updateProfile | Atualizar perfil do host |
| GET | `/get-count-campaigns-by-host` | getCountCampaignsByHost | Contagem de campanhas do host |
| GET | `/get-kols` | getKols | Listar KOLs |
| GET | `/campaigns` | getCampaigns | Campanhas do host logado |
| GET | `/campaigns/:id/leaderboard-submits` | getLeaderboardSubmits | Leaderboard de submissões da campanha |
| GET | `/campaigns/:id/get-users-campaign-winners` | getUsersCampaignWinners | Usuários vencedores da campanha |
| GET | `/campaigns/:id/generate-rank-twitter` | generateRankTwitter | Gerar rank por Twitter |
| POST | `/campaigns/:id/create-campaign-winners` | createCampaignWinners | Definir vencedores da campanha |
| GET | `/get-info-post-twitter-creator/:id` | getInfoPostTwitterCreator | Info do post Twitter do creator |
| POST | `/campaigns` | createCampaign | Criar campanha |
| PUT | `/campaigns/:id` | editCampaign | Editar campanha |
| DELETE | `/campaigns/:id` | deleteCampaign | Excluir campanha |
| PUT | `/fixed-comment-host` | fixedCommentHost | Comentário fixo do host |

## Handlers não expostos nas rotas atuais

- **toggleCampaignStatus** – alteração de status da campanha (provavelmente usado apenas pelo Admin ou em outra rota).
