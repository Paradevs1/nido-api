/**
 * Cenário 2: Stress em getEscrowStatus
 * Objetivo: validar que o endpoint de status aguenta 200 VUs por 30s
 *
 * Executar: k6 run tests/load/status-stress.js -e TOKEN=<jwt> -e JOB_ID=<jobId> -e BASE_URL=http://localhost:3002
 */
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 50 },
    { duration: '20s', target: 200 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% das requests < 2s
    http_req_failed: ['rate<0.05'],    // menos de 5% de erros
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const TOKEN = __ENV.TOKEN || '';
const JOB_ID = __ENV.JOB_ID || 'test-job-id';

export default function () {
  const res = http.get(`${BASE_URL}/api/stellar/escrow/${JOB_ID}/status`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  check(res, {
    'status 200 ou 404': (r) => r.status === 200 || r.status === 404,
    'resposta válida': (r) => r.body.length > 0,
  });
}
