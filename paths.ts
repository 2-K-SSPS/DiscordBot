import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path of the project root, independent of the current working directory.
 *
 * Lives here rather than in `config.ts` so that importing it does not also trigger
 * `config.json` loading — `utils/db.ts` needs the path but not the credentials.
 */
export const projectRoot = dirname(fileURLToPath(import.meta.url));
