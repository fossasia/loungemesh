import app from './app.js';
import { prisma } from './config/db.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    try {
      console.log('Verifying database connection...');
      await prisma.$connect();
      console.log('Database connected successfully.');

      // In production or when AUTO_MIGRATE=true, ensure migrations are deployed
      if (process.env.AUTO_MIGRATE === 'true' || process.env.NODE_ENV === 'production') {
        console.log('Running prisma migrate deploy...');
        const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
          timeout: 30000,
        });
        if (stdout) console.log(stdout.trim());
        if (stderr) console.error(stderr.trim());
      }
    } catch (dbErr) {
      console.error('Fatal: Database setup or migration deployment failed during bootstrap:', dbErr);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`LoungeMesh backend listening on port ${PORT}`);
  });
}

bootstrap();
