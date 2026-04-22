# AdminController

## Descrição

Controller responsável pelas operações administrativas da API. Expõe listagens (creators, hosts, pagamentos, short URLs por campanha), combos para dropdowns, estatísticas de campanhas, atualização de plano de hosts e exportação em Excel dos mesmos dados dos endpoints de listagem.

## Base path

`/api/admin`

## Autenticação

Todas as rotas exigem **adminGuard** (usuário autenticado com tipo **ADMIN**).  
Header: `Authorization: Bearer <token>`.

## Serviço

- **AdminService** (`src/services/AdminService.ts`)

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| GET | `/creators` | getCreatorsList | Lista creators com paginação e filtro por twitter_username/search |
| GET | `/payments` | getPaymentsList | Lista unificada de pagamentos (Winners, Active Campaign, Refunds, Plans) com filtros |
| GET | `/users/:userId` | getUserDetail | Detalhe do usuário + payments_count, payments_confirmed_count |
| PATCH | `/users/:userId/active` | setUserActive | Ativar/desativar usuário (body: isActive) |
| GET | `/hosts/options` | getHostsCombo | Combo de hosts (host_id, name_company) |
| GET | `/hosts` | getHostsList | Lista hosts com paginação e filtros (search, isActive) |
| GET | `/campaigns/options` | getCampaignsCombo | Combo de campanhas (id, name) |
| GET | `/campaigns/counts` | getCampaignCountsPrivatePublic | Contagem de campanhas privadas e públicas |
| GET | `/campaigns/:campaignId/short-urls` | getCampaignShortUrls | Short URLs dos creators por campanha (twitter_username, shortURL, clicks) |
| PATCH | `/hosts/:hostId/plan` | updateHostPlan | Atualizar plano do host (body: plan_id) |
| GET | `/export/campaigns/:campaignId/short-urls` | exportShortUrlsExcel | Export Excel – Short URLs da campanha |
| GET | `/export/creators` | exportCreatorsExcel | Export Excel – Creators |
| GET | `/export/hosts` | exportHostsExcel | Export Excel – Hosts |
| GET | `/export/payments` | exportPaymentsExcel | Export Excel – Pagamentos |
| GET | `/campaign-stats/:campaignId` | getCampaignStats | Estatísticas da campanha (views, likes, retweets, replies, submissions, winners) |

## Handlers não expostos nas rotas atuais

- **exportUsersWithSubmissions** – comentado na rota; export Excel de usuários com submissões.
