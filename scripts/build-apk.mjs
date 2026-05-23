#!/usr/bin/env node
// Build APK Capacitor: generate Nuxt SPA + sync + gradle assembleDebug + optional install.
// Usage: node scripts/build-apk.mjs [--release] [--no-install]

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const isWin = process.platform === 'win32'

const args = process.argv.slice(2)
const isRelease = args.includes('--release')
const skipInstall = args.includes('--no-install')
const skipBuild = args.includes('--no-build')

const API_BASE = process.env.NUXT_PUBLIC_API_BASE || 'https://absensi-karyawan-sepia.vercel.app'
const ANDROID_HOME = process.env.ANDROID_HOME || 'D:\\sdk-as'
const JAVA_HOME = process.env.JAVA_HOME || 'D:\\android-studio\\jbr'
const ADB = join(ANDROID_HOME, 'platform-tools', isWin ? 'adb.exe' : 'adb')

const env = {
  ...process.env,
  CAPACITOR: 'true',
  NUXT_PUBLIC_API_BASE: API_BASE,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  JAVA_HOME
}

function step(name, fn) {
  const start = Date.now()
  console.log(`\n>>> ${name}`)
  fn()
  console.log(`    done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

function run(cmd, opts = {}) {
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit', env, cwd: root, ...opts })
  if (r.status !== 0) {
    console.error(`\nCommand failed (exit ${r.status}): ${cmd}`)
    process.exit(r.status || 1)
  }
}

function runCapture(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, encoding: 'utf8', env, cwd: root, ...opts })
}

// Nuxi `generate` sometimes hangs after writing files. Watch stdout for the success
// marker, then force-kill the process tree so the pipeline can continue.
function runNuxtGenerate() {
  return new Promise((resolveP, rejectP) => {
    const child = spawn('npm', ['run', 'build:capacitor'], {
      shell: true, env, cwd: root, stdio: ['ignore', 'pipe', 'pipe']
    })
    let done = false
    let killTimer = null
    const onChunk = (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      // Success marker: nuxi prints this line when public/ is fully written.
      if (!done && text.includes('Generated public')) {
        done = true
        // Give nuxt 3s to exit cleanly; if it hangs, force-kill.
        killTimer = setTimeout(() => {
          if (isWin) spawnSync('taskkill', ['/pid', child.pid, '/T', '/F'])
          else child.kill('SIGKILL')
        }, 3000)
      }
    }
    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)
    child.on('exit', (code) => {
      if (killTimer) clearTimeout(killTimer)
      if (done || code === 0) resolveP()
      else rejectP(new Error(`nuxt generate exited with code ${code}`))
    })
  })
}

console.log(`Building APK [${isRelease ? 'release' : 'debug'}]`)
console.log(`  API base : ${API_BASE}`)
console.log(`  SDK      : ${ANDROID_HOME}`)
console.log(`  JDK      : ${JAVA_HOME}`)

if (skipBuild) {
  console.log('\n--no-build passed, skipping nuxt generate.')
} else {
  console.log('\n>>> 1. Nuxt generate (SPA shell)')
  const t1 = Date.now()
  await runNuxtGenerate()
  console.log(`    done in ${((Date.now() - t1) / 1000).toFixed(1)}s`)
}

step('2. Capacitor sync android',   () => run('npx cap sync android'))
step('3. Gradle assemble',          () => {
  const task = isRelease ? 'assembleRelease' : 'assembleDebug'
  const gradlew = isWin ? 'gradlew.bat' : './gradlew'
  run(`${gradlew} ${task} --console=plain`, { cwd: join(root, 'android') })
})

const apkPath = isRelease
  ? join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
  : join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

if (!existsSync(apkPath)) {
  console.error(`\nAPK not found at expected path: ${apkPath}`)
  process.exit(1)
}

const sizeMB = (statSync(apkPath).size / 1024 / 1024).toFixed(2)
console.log(`\nAPK ready: ${apkPath} (${sizeMB} MB)`)

if (skipInstall) {
  console.log('\n--no-install passed, skipping device install.')
  process.exit(0)
}

if (!existsSync(ADB)) {
  console.log('\nadb not found, skipping install.')
  process.exit(0)
}

const devices = runCapture(`"${ADB}" devices`).stdout || ''
const deviceLines = devices.split('\n').slice(1).filter((l) => l.trim() && l.includes('\tdevice'))
if (deviceLines.length === 0) {
  console.log('\nNo USB device connected. APK ready at the path above.')
  process.exit(0)
}

step('4. adb install', () => run(`"${ADB}" install -r "${apkPath}"`))
step('5. relaunch app', () => {
  run(`"${ADB}" shell am force-stop id.absensi.karyawan`)
  run(`"${ADB}" shell monkey -p id.absensi.karyawan -c android.intent.category.LAUNCHER 1`)
})

console.log('\nDone. App is running on device.')
