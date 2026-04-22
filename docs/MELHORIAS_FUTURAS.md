# Melhorias Futuras (Severidade Media/Baixa)

Itens identificados na auditoria que nao sao urgentes mas devem ser planejados.

---

## MEDIO

### 1. Controllers muito grandes (god classes)
- **Localizacao:** HostController (88KB), CreatorController (69KB), AuthController (50KB), AdminController (40KB)
- **Problema:** Controllers com milhares de linhas misturam validacao, logica de negocio e formatacao de resposta. Dificulta manutencao, code review e testes.
- **Recomendacao:** Controllers devem ter 10-20 linhas por metodo. Extrair logica para services. Subdividir services grandes por dominio (ex: CampaignPaymentService, CampaignSubmissionService).

### 2. Sem pipeline de CI/CD
- **Localizacao:** Nenhum `.github/workflows/`, Jenkinsfile ou similar
- **Problema:** Codigo vai direto para producao sem lint, type-check ou testes automatizados. Bugs e regressoes passam sem deteccao.
- **Recomendacao:** Criar `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
```

### 3. Instanciacao de services acoplada nos controllers
- **Localizacao:** Todos os controllers — `constructor() { this.service = new Service(); }`
- **Problema:** Acoplamento forte. Impossivel substituir services em testes. Dificulta reutilizacao.
- **Recomendacao:** Usar singleton pattern ou dependency injection simples (passar service no constructor).

---

## BAIXO

### 4. Body parser com limite de 10MB
- **Localizacao:** `src/app.ts` — `express.json({ limit: '10mb' })`
- **Problema:** Permite payloads muito grandes (logos em base64). Vetor para exaustao de memoria.
- **Recomendacao:** Reduzir para 1-2MB. Usar upload de arquivos separado (S3/Cloudflare R2) para imagens.
