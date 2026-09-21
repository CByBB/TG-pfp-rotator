import 'dotenv/config';

export interface Config {
  botToken: string;
  apiId: number;
  apiHash: string;
  dataDir: string;
  repoUrl: string;
  donationUrl: string;
  logLevel: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  const apiId = Number(required('API_ID'));
  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new Error('API_ID must be a positive integer from https://my.telegram.org');
  }

  return {
    botToken: required('BOT_TOKEN'),
    apiId,
    apiHash: required('API_HASH'),
    dataDir: process.env.DATA_DIR?.trim() || './data',
    repoUrl: process.env.REPO_URL?.trim() || 'https://github.com/CByBB/TG-pfp-rotator',
    donationUrl: process.env.DONATION_URL?.trim() || 'https://nowpayments.io/donation/CodeByBB',
    logLevel: process.env.LOG_LEVEL?.trim() || 'info',
  };
}
