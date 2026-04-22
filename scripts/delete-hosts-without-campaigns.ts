/**
 * Remove usuários HOST com campaigns_created: 0 e sem nenhuma campanha na coleção campaigns.
 *
 * Uso:
 *   npm run delete-hosts-without-campaigns
 *   npm run delete-hosts-without-campaigns:dry          # só lista, não apaga (Windows/macOS/Linux)
 *   npx ts-node scripts/delete-hosts-without-campaigns.ts --dry-run
 *
 * Variável DRY_RUN (bash/macOS/Linux): DRY_RUN=1 npm run delete-hosts-without-campaigns
 * PowerShell (Windows): $env:DRY_RUN='1'; npm run delete-hosts-without-campaigns
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DRY_RUN =
  process.env['DRY_RUN'] === '1' ||
  process.env['DRY_RUN'] === 'true' ||
  process.argv.includes('--dry-run');

async function main() {
  const { getBountiesDB } = await import('../src/config/database');
  const { UserModel } = await import('../src/models/User');

  await getBountiesDB();
  const db = await getBountiesDB();
  const usersCollection = db.collection('users');
  const campaignsCollection = db.collection('campaigns');

  const hosts = await usersCollection
    .find({ user_type: 'HOST', campaigns_created: 0 })
    .toArray();

  console.log(`Encontrados ${hosts.length} HOST(s) com campaigns_created: 0\n`);

  let deleted = 0;
  let skippedHasCampaigns = 0;

  for (const host of hosts) {
    const id = host['_id']!.toString();
    const email = (host['email'] as string | undefined) || '';
    const username = (host['username'] as string | undefined) || '';

    const campaignCount = await campaignsCollection.countDocuments({ host_id: id });

    if (campaignCount > 0) {
      console.warn(
        `[SKIP] ${id} (${email || username}) — campaigns_created=0 mas existem ${campaignCount} campanha(s) com este host_id`
      );
      skippedHasCampaigns++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[DRY RUN] Removeria: ${id} | ${email || username}`);
      deleted++;
      continue;
    }

    const ok = await UserModel.deleteById(id);
    if (ok) {
      deleted++;
      console.log(`Removido: ${id} | ${email || username}`);
    } else {
      console.warn(`Falha ao remover: ${id}`);
    }
  }

  console.log(
    `\nConcluído. Removidos: ${deleted}, ignorados (inconsistência / já tinha campanha): ${skippedHasCampaigns}, DRY_RUN=${DRY_RUN}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
