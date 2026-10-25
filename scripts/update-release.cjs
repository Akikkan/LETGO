const asar = require('@electron/asar');
const fs = require('node:fs/promises');
const path = require('node:path');

async function updateRelease() {
  const root = path.join(__dirname, '..');
  const tempDir = path.join(root, '.build-cache', 'asar-staging');
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'ui'), { recursive: true });

  await fs.copyFile(path.join(root, 'package.json'), path.join(tempDir, 'package.json'));
  for (const file of ['main.cjs', 'metadata.cjs', 'preload.cjs', 'workspace.cjs', 'image-viewer.js', 'image-viewer.css', 'project-sidebar.js', 'project-sidebar.css', 'icon.png']) {
    const srcFile = path.join(root, 'src', file);
    if (await fs.stat(srcFile).then(() => true, () => false)) {
      await fs.copyFile(srcFile, path.join(tempDir, 'src', file));
    }
  }
  for (const file of ['index.html', 'app.js', 'style.css']) {
    await fs.copyFile(path.join(root, 'ui', file), path.join(tempDir, 'ui', file));
  }

  const asarTarget = path.join(root, 'release-v0.2', 'Shiguang-win32-x64', 'resources', 'app.asar');
  await asar.createPackage(tempDir, asarTarget);
  console.log('Successfully updated release app.asar!');
}

updateRelease().catch(err => {
  console.error(err);
  process.exit(1);
});
