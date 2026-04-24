import * as path from 'path'
import * as fs from 'fs-extra'

export async function ensureGameFiles(instanceDir: string) {
  // Write options.txt if missing - prevents first-launch crash
  const optionsPath = path.join(instanceDir, 'options.txt')
  if (!await fs.pathExists(optionsPath)) {
    await fs.writeFile(optionsPath, [
      'version:3',
      'autoJump:false',
      'renderDistance:8',
      'maxFps:260',
      'fboEnable:true',
      'ao:2',
      'particles:0',
      'lang:en_us',
    ].join('\n'))
  }

  // Create logs dir
  await fs.ensureDir(path.join(instanceDir, 'logs'))
  await fs.ensureDir(path.join(instanceDir, 'crash-reports'))
}
