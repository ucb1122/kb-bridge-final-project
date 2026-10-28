import path from 'node:path';

export function resolvePublicFile(projectRoot, pathname) {
  const publicRoot = path.join(projectRoot, 'frontend');
  const requested = decodeURIComponent(pathname === '/' ? '/pages/rising/index.html' : pathname.endsWith('/') ? pathname + 'index.html' : pathname);
  const file = path.resolve(publicRoot, '.' + requested);
  if (!file.startsWith(publicRoot + path.sep) || path.basename(file).startsWith('.')) return null;
  return file;
}
