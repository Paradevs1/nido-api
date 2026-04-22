# JobController

## Descrição

Controller para **execução manual de jobs** (cron-like): expiração de campanhas, atualização de informações de post (Get Info Post X), atualização de cliques (Short.io) e atualização de seguidores do Twitter. Útil para testes e para disparar jobs sob demanda além do agendamento automático.

## Base path

`/api/jobs`

## Autenticação

Rotas **sem guard** de autenticação na definição do router. Em produção é recomendável proteger com API key ou role admin para evitar execução indevida.

## Serviço

- **JobService** (`src/services/JobService.ts`)

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| POST | `/run-expired-campaigns` | runExpiredCampaignsJob | Executar job de campanhas expiradas |
| GET | `/run-expired-campaigns` | runExpiredCampaignsJob | Idem (GET para facilitar chamada manual) |
| POST | `/run-get-info-post-x` | runGetInfoPostX | Buscar/atualizar info de posts (Twitter/X) |
| GET | `/run-get-info-post-x` | runGetInfoPostX | Idem |
| POST | `/run-get-clicks` | runGetClicksJob | Atualizar cliques (Short.io) |
| GET | `/run-get-clicks` | runGetClicksJob | Idem |
| POST | `/run-update-twitter-followers` | runUpdateTwitterFollowersJob | Atualizar contagem de seguidores (Twitter) dos creators |
| GET | `/run-update-twitter-followers` | runUpdateTwitterFollowersJob | Idem |

## Observações

- Cada job possui equivalente GET e POST para permitir disparo por browser ou por scheduler/curl.
- Os jobs em produção costumam ser agendados (ex.: cron) chamando esses endpoints ou os métodos do JobService diretamente.
