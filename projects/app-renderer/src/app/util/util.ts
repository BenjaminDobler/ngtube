import { existsSync, mkdirSync } from 'fs';
import { remote } from 'electron';
import { join } from 'path';

const downloadDir = join(remote.app.getPath('documents'), 'ngtube');
if (!existsSync(downloadDir)) {
  mkdirSync(downloadDir);
}

export { downloadDir };
