/**
 * Cenário 3: Flood de requests não autorizadas
 * Objetivo: verificar que authGuard aguenta volume sem degradar
 *
 * Executar: k6 run tests/load/auth-flood.js -e BASE_URL=http://localhost:3002
 */
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 500,
  duration: '10s',
  thresholds: {
    // 100% das respostas devem ser 401
    'checks{check:returns_401}': ['rate==1.0'],
    // authGuard não pode ficar lento sob carga
    http_req_duration: ['p(99)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';

const ENDPOINTS = [
  { method: 'POST', path: '/api/stellar/escrow/create' },
  { method: 'POST', path: '/api/stellar/escrow/release' },
  { method: 'POST', path: '/api/stellar/escrow/refund' },
  { method: 'GET', path: '/api/stellar/escrow/flood-test/status' },
  { method: 'POST', path: '/api/stellar/dispute' },
];

export default function () {
  const endpoint = ENDPOINTS[__VU % ENDPOINTS.length];
  const res = endpoint.method === 'GET'
    ? http.get(`${BASE_URL}${endpoint.path}`)
    : http.post(`${BASE_URL}${endpoint.path}`, '{}', {
        headers: { 'Content-Type': 'application/json' },
        // Sem Authorization header propositalmente
      });

  check(res, {
    'returns_401': (r) => r.status === 401,
  });
}
