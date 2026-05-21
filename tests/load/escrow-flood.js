/**
 * Cenário 1: Flood em createEscrow com mesmo jobId
 * Objetivo: verificar que o duplicate guard aguenta carga concorrente
 *
 * Executar: k6 run tests/load/escrow-flood.js -e TOKEN=<jwt> -e BASE_URL=http://localhost:3002
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const duplicateRejections = new Counter('duplicate_rejections');
const unexpectedCreations = new Counter('unexpected_creations');

export const options = {
  vus: 50,
  duration: '15s',
  thresholds: {
    // Nenhuma criação inesperada de escrow duplicado
    unexpected_creations: ['count==0'],
    // Taxa de erros HTTP < 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const payload = JSON.stringify({
    jobId: 'load-test-flood-job-001', // mesmo jobId para todos
    hostPublicKey: 'GBSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    talentPublicKey: 'GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    amount: '10',
  });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  };

  const res = http.post(`${BASE_URL}/api/stellar/escrow/create`, payload, { headers });

  if (res.status === 201) {
    // Apenas a primeira iteração deve criar com sucesso
    if (__ITER > 0) {
      unexpectedCreations.add(1);
    }
  } else if (res.status === 500) {
    const body = JSON.parse(res.body || '{}');
    if (body.message && body.message.includes('already exists')) {
      duplicateRejections.add(1);
    }
  }

  check(res, {
    'não criou duplicata inesperada': (r) => !(r.status === 201 && __ITER > 0),
    'resposta rápida (< 3s)': (r) => r.timings.duration < 3000,
  });

  sleep(0.1);
}
