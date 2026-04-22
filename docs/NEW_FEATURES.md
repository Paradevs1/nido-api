# Novas Implementacoes - Bounties API

## 1. Creator - Imagens na Submissao

### Descricao
O endpoint de submissao do creator agora aceita uma lista de imagens em Base64 (`submissions_images`) que sao salvas junto com a submissao e retornadas nos detalhes da campanha. Mesmo padrao utilizado no campo `logo_company` do User.

### Endpoint

`POST /api/creator/submit-campaign/:campaign_id`

### Request Body (novos campos)

```json
{
  "submission_twitter": "https://twitter.com/...",
  "submission_tiktok": "https://tiktok.com/...",
  "submission_instagram": "https://instagram.com/...",
  "submission_youtube": "https://youtube.com/...",
  "submission_feedback": "...",
  "submissions_kols": ["https://link1.com"],
  "submissions_images": ["data:image/png;base64,iVBORw0KGgo...", "data:image/jpeg;base64,/9j/4AAQSk..."]
}
```

### Response

O campo `submissions_images` e retornado na resposta da submissao e tambem nos detalhes da campanha (`GET /api/host/campaigns/:id`) quando o creator esta autenticado.

### Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/models/CampaignParticipants.ts` | Campo `submissions_images?: string[]` na interface |
| `src/dtos/campaignParticipants.dto.ts` | Campo na interface e no `formatCampaignParticipantResponse` |
| `src/dtos/campaign.dto.ts` | Campo na interface `CampaignResponse` |
| `src/controllers/CreatorController.ts` | Extrai `submissions_images` do body e passa ao service |
| `src/services/CreatorService.ts` | Recebe e salva `submissions_images` no create e update |
| `src/services/HostService.ts` | Busca e retorna `submissions_images` no `formatCampaignResponse` |

---

## 2. Admin - Metricas da Campanha

### Descricao
Endpoint para recuperar metricas agregadas de uma campanha, incluindo totais gerais e metricas individuais por creator (post_kols). Soma metricas de todas as plataformas (Twitter, Instagram, TikTok, YouTube).

### Endpoint

`GET /api/admin/campaign-metrics/:campaignId`

### Response

```json
{
  "title": "Nome da campanha",
  "total_posts": 15,
  "total_submissions": 5,
  "total_likes": 1280,
  "total_views": 22866,
  "total_replies": 33,
  "total_retweets": 94,
  "total_quotes": 10,
  "total_bookmarks": 242,
  "post_kols": [
    {
      "username": "creator1",
      "total_submissions": 3,
      "total_likes": 400,
      "total_views": 5000,
      "total_replies": 10,
      "total_retweets": 20,
      "total_bookmarks": 50,
      "submissions": ["https://twitter.com/...", "https://tiktok.com/..."]
    }
  ]
}
```

### Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/services/AdminService.ts` | Metodo `getCampaignMetrics()` |
| `src/controllers/AdminController.ts` | Handler `getCampaignMetrics` com Swagger |
| `src/routes/admin.routes.ts` | Rota `GET /campaign-metrics/:campaignId` |

---

## 3. Host - Metricas da Campanha

### Descricao
Endpoint identico ao do admin, porem restrito ao host dono da campanha. Valida que `campaign.host_id === userId` do token.

### Endpoint

`GET /api/host/campaigns/:id/metrics`

### Response

Mesmo formato do endpoint admin.

### Erros

| Status | Condicao |
|---|---|
| 401 | Token ausente ou invalido |
| 403 | Host nao e dono da campanha |
| 404 | Campanha nao encontrada |

### Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/services/HostService.ts` | Metodo `getCampaignMetrics(campaignId, hostId)` |
| `src/controllers/HostController.ts` | Handler `getCampaignMetrics` com Swagger |
| `src/routes/host.routes.ts` | Rota `GET /campaigns/:id/metrics` |

---

## 4. Admin - Metricas de Instagram Story

### Descricao
Endpoints para o admin adicionar, editar ou excluir manualmente metricas de Instagram Story de um usuario em uma campanha. Necessario porque stories nao possuem URL publica e nao podem ser coletados por scraper.

### Endpoints

**Adicionar/Editar:** `PUT /api/admin/instagram-story-metrics`

```json
{
  "campaign_id": "...",
  "user_id": "...",
  "likes": 150,
  "views": 3000,
  "retweets": 45,
  "replies": 20
}
```

**Excluir (zerar):** `DELETE /api/admin/instagram-story-metrics`

```json
{
  "campaign_id": "...",
  "user_id": "..."
}
```

### Novos Campos em ICampaignParticipants

| Campo | Tipo |
|---|---|
| `views_instagram_story` | `number` |
| `replies_instagram_story` | `number` |
| `retweets_instagram_story` | `number` |
| `likes_instagram_story` | `number` |

### Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/models/CampaignParticipants.ts` | 4 campos novos + metodos `updateInstagramStoryData` e `clearInstagramStoryData` |
| `src/services/AdminService.ts` | Metodos `upsertInstagramStoryMetrics` e `deleteInstagramStoryMetrics` |
| `src/controllers/AdminController.ts` | 2 handlers com Swagger |
| `src/routes/admin.routes.ts` | Rotas `PUT` e `DELETE /instagram-story-metrics` |

---

## 5. Metricas por Plataforma (Novos Campos)

### Descricao
Campos de metricas para TikTok, Instagram e YouTube adicionados em `ICampaignParticipants`, seguindo o mesmo padrao do Twitter.

### Campos Adicionados

**TikTok:**
`media_tiktok`, `views_tiktok`, `replies_tiktok`, `retweets_tiktok`, `quotes_tiktok`, `bookmarks_tiktok`, `likes_tiktok`

**Instagram:**
`media_instagram`, `views_instagram`, `replies_instagram`, `retweets_instagram`, `quotes_instagram`, `bookmarks_instagram`, `likes_instagram`

**YouTube:**
`media_youtube`, `views_youtube`, `replies_youtube`, `retweets_youtube`, `quotes_youtube`, `bookmarks_youtube`, `likes_youtube`

**Instagram Story:**
`views_instagram_story`, `replies_instagram_story`, `retweets_instagram_story`, `likes_instagram_story`

### Campaign Model

Adicionado `is_job_youtube_executed: boolean` em `ICampaign` para controlar execucao do job de scraping do YouTube (mesmo padrao do Twitter, Instagram e TikTok).

---

## 6. Job - Scraper de Metricas (Apify)

### Descricao
Cron job que coleta metricas de posts em Instagram, TikTok e YouTube usando scrapers do Apify. Processa campanhas em status `waiting payment` que ainda nao foram executadas (flags `is_job_*_executed: false`).

### Endpoint

`POST /api/jobs/run-get-metrics-submissions`
`GET /api/jobs/run-get-metrics-submissions`

### Vercel Cron

Configurado em `vercel.json` com schedule `*/1 * * * *` (a cada 1 minuto).

### Scrapers Apify Utilizados

| Plataforma | Actor ID | Input | Metricas Coletadas |
|---|---|---|---|
| Instagram | `apify/instagram-scraper` | `directUrls` + `resultsType: 'posts'` | views, likes, comments, media type |
| TikTok | `clockworks/tiktok-video-scraper` | `postURLs` | views, likes, comments, shares, saves |
| YouTube | `streamers/youtube-scraper` | `startUrls` | views, likes, comments |

### Fluxo

1. Busca campanhas `waiting payment` com flag `is_job_*_executed: false`
2. Para cada participante com submission valida, chama o Apify actor
3. Salva metricas no documento do participante via `update*Data()`
4. Marca a flag `is_job_*_executed: true` na campanha

### Response

```json
{
  "success": true,
  "instagram": { "processed": 2, "updated": 1 },
  "tiktok": { "processed": 1, "updated": 1 },
  "youtube": { "processed": 1, "updated": 1 },
  "timestamp": "2026-03-27T21:43:29.731Z",
  "message": "Job completed. Instagram: 1/2, TikTok: 1/1, YouTube: 1/1"
}
```

### Configuracao Necessaria

Adicionar no `.env`:
```
APIFY_API_TOKEN=seu_token_aqui
```

O Apify oferece $5/mes de creditos gratuitos compartilhados entre todos os actors.

### Arquivos Criados

| Arquivo | Descricao |
|---|---|
| `src/services/social_medias/ApifyService.ts` | Cliente generico para Apify API |
| `src/services/social_medias/InstagramService.ts` | Scraper de posts do Instagram |
| `src/services/social_medias/TiktokService.ts` | Scraper de videos do TikTok |
| `src/services/social_medias/YoutubeService.ts` | Scraper de videos do YouTube |

### Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/models/CampaignParticipants.ts` | Metodos `findPending*JobParticipants` e `update*Data` para cada plataforma |
| `src/models/Campaign.ts` | Campo `is_job_youtube_executed` |
| `src/services/JobService.ts` | Metodo `runGetMetricsSubmissions` e metodos privados de processamento |
| `src/controllers/JobController.ts` | Handler `runGetMetricsSubmissions` com Swagger |
| `src/routes/job.routes.ts` | Rotas POST/GET |
| `vercel.json` | Cron job configurado |

---

## Resumo de Todos os Novos Endpoints

| Metodo | Rota | Role | Descricao |
|---|---|---|---|
| `POST` | `/api/creator/submit-campaign/:id` | CREATOR | Submissao (agora com `submissions_images`) |
| `GET` | `/api/host/campaigns/:id/metrics` | HOST | Metricas da campanha do host |
| `GET` | `/api/admin/campaign-metrics/:id` | ADMIN | Metricas da campanha (admin) |
| `PUT` | `/api/admin/instagram-story-metrics` | ADMIN | Adicionar/editar metricas de story |
| `DELETE` | `/api/admin/instagram-story-metrics` | ADMIN | Excluir metricas de story |
| `POST` | `/api/admin/run-all-metrics/:campaignId` | ADMIN | Rodar scraper de todas plataformas para uma campanha (sem filtro de status, sem atualizar flags) |
| `POST/GET` | `/api/jobs/run-get-metrics-submissions` | - | Job de scraping Apify |
