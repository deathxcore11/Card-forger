import { spawnSync } from 'node:child_process';
const docker = process.env.WRANGLER_DOCKER_BIN || 'docker';
const result = spawnSync(docker, ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', timeout: 10_000, maxBuffer: 32_768 });
const text = result.stderr || '';
const classification = result.error?.code === 'ENOENT' ? 'docker_executable_missing'
  : /permission denied/i.test(text) ? 'docker_permission_denied'
  : /cannot connect|connection refused|is the docker daemon running/i.test(text) ? 'docker_daemon_unavailable'
  : result.status !== 0 ? 'docker_info_failed' : 'available';
const version = (result.stdout || '').trim();
let diagnostic = text.slice(-3000);
for (const [name, value] of Object.entries(process.env)) if (/TOKEN|SECRET|PASSWORD|API_KEY|AUTH_CONFIG/.test(name) && value?.length >= 8) diagnostic = diagnostic.split(value).join('[redacted]');
diagnostic = diagnostic.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[redacted]@');
console.log(JSON.stringify({ check: 'builder-docker', result: classification, configuredExecutable: docker !== 'docker',
  exitCode: result.status, spawnCode: result.error?.code || null,
  version: /^[A-Za-z0-9_.+-]{1,80}$/.test(version) ? version : null,
  dockerHostConfigured: !!process.env.DOCKER_HOST, wranglerDockerHostConfigured: !!process.env.WRANGLER_DOCKER_HOST,
  diagnostic, imageBuildAttempted: false }));
if (classification !== 'available') process.exitCode = 1;
if (docker !== 'docker') {
  console.log('This proof requires the Docker-compatible executable to be available as docker on PATH.');
  process.exitCode = 1;
}
