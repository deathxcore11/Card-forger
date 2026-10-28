// Local read-only guard. No configuration or publication is performed.
import { readFile } from 'node:fs/promises';
import { validateReleasePolicy } from '../src/release-policy.mjs';
const [configFile] = process.argv.slice(2);
if (!configFile) throw Error('Wrangler config path required');
const config = JSON.parse((await readFile(configFile, 'utf8')).replace(/^\s*\/\/.*$/gm, ''));
const release = JSON.parse(config.vars?.FORGE_RELEASE_POLICY_JSON || 'null');
validateReleasePolicy(release, config.vars?.FORGE_CONTAINER_IMAGE);
if (config.containers?.length !== 1 || config.containers[0].image !== release.containerImage || config.containers[0].max_instances !== 4) throw Error('configured_container_image_or_capacity_drift');
console.log('PASS explicit immutable image/CPU/rules binding; not deployment or runtime proof');
