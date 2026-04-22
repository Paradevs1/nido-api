import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bounties API',
      version: '1.0.0',
      description: 'API REST para gerenciamento de bounties (recompensas por tarefas)',
      contact: {
        name: 'API Support',
        email: 'support@bounties.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Servidor de desenvolvimento'
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication and authorization operations'
      },
      {
        name: 'Host',
        description: 'Host operations'
      },
      {
        name: 'Creator',
        description: 'Creator operations'
      },
      {
        name: 'Payments',
        description: 'Payment and blockchain transaction operations'
      },
      {
        name: 'Admin',
        description: 'Endpoints restricted to ADMIN users'
      },
      {
        name: 'Jobs',
        description: 'Cron jobs (expired campaigns, Twitter info, clicks, auto payment)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJsdoc(options);

export default specs;
