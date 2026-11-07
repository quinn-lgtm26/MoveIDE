import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { OPENCAP_REVISION } from './import.mjs'

function command(executable, args) {
  try { return execFileSync(executable, args, { encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return null }
}

const repoIndex = process.argv.indexOf('--repo')
const repo = repoIndex < 0 ? null : process.argv[repoIndex + 1]
if (repoIndex >= 0 && (!repo || repo.startsWith('--'))) throw new Error('--repo needs an existing upstream checkout path')
const revision = repo ? command('git', ['-C', repo, 'rev-parse', 'HEAD']) : null
const nvidia = command('nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader'])
const platformSupported = process.platform === 'linux' && process.arch === 'x64'
const result = {
  schemaVersion: 1,
  engine: 'opencap-monocular',
  expectedRevision: OPENCAP_REVISION,
  observedRevision: revision,
  platform: process.platform,
  architecture: process.arch,
  nvidiaRuntimeDetected: nvidia !== null,
  status: !platformSupported || nvidia === null ? 'unsupported-runtime' : 'external-setup-required',
  capabilities: { localMotionImport: true, nativeInferenceVerified: false },
  checks: {
    supportedHost: platformSupported,
    pinnedSource: revision === OPENCAP_REVISION,
    cudaPythonAndOpenSim: 'not-tested',
    modelWeightsAndSMPL: 'not-provisioned-by-moveide',
    codeAndAssetTerms: 'operator-review-required',
    sourceCameraAndSubjectMetadata: 'required-for-inference',
    originalFrameAlignment: 'must-be-exported-and-independently-verified',
  },
  scope: 'Read-only host preflight. Does not download models, accept terms, execute upstream code, or infer on video.',
}
if (process.argv.includes('--write')) writeFileSync(new URL('./preflight-result.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
