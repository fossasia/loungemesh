import { prisma } from '../config/db.js';
import { sha256 } from '../oauth/crypto.js';

async function main() {
  const args = process.argv.slice(2);
  const clientId = args[0] || process.env.EVENTYAY_OAUTH_CLIENT_ID || 'eventyay';
  const clientSecret = args[1] || process.env.EVENTYAY_OAUTH_CLIENT_SECRET || process.env.EVENTYAY_SERVICE_SECRET;
  if (!clientSecret) {
    console.error('Error: EVENTYAY_OAUTH_CLIENT_SECRET or EVENTYAY_SERVICE_SECRET must be provided as an argument or environment variable.');
    process.exit(1);
  }
  const name = args[2] || 'Eventyay';
  const defaultUris = [
    'http://localhost:8000/control/admin/video/loungemesh/oauth/callback/',
    'http://127.0.0.1:8000/control/admin/video/loungemesh/oauth/callback/',
    'http://localhost:8000/control/loungemesh/callback/',
    'http://127.0.0.1:8000/control/loungemesh/callback/',
    'https://eventyay.com/control/admin/video/loungemesh/oauth/callback/',
    'https://dev.eventyay.com/control/admin/video/loungemesh/oauth/callback/',
  ].join(',');
  const rawUris = args[3] || process.env.EVENTYAY_OAUTH_REDIRECT_URIS || defaultUris;
  const redirectUris = rawUris.split(',').map((u) => u.trim()).filter(Boolean);

  console.log(`Registering OAuth client: ${clientId} (${name})`);
  console.log(`Redirect URIs:`, redirectUris);

  const clientSecretHash = sha256(clientSecret);

  const client = await prisma.oAuthClient.upsert({
    where: { clientId },
    update: {
      clientSecretHash,
      name,
      redirectUris,
    },
    create: {
      clientId,
      clientSecretHash,
      name,
      redirectUris,
    },
  });

  console.log(`Successfully registered client:`, client.clientId);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to register OAuth client:', err);
  process.exit(1);
});
