import { pathToFileURL } from 'node:url';

const MANAGEMENT_API = 'https://api.supabase.com/v1';
const DEFAULT_STATUS_CHECKS = 30;
const DEFAULT_STATUS_INTERVAL_MS = 30_000;
const DEFAULT_ACTIVITY_REQUESTS = 3;

function requireValue(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function projectRefFromUrl(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  const suffix = '.supabase.co';
  if (!hostname.endsWith(suffix)) {
    throw new Error(`SUPABASE_URL must use a *.supabase.co hostname: ${hostname}`);
  }
  return hostname.slice(0, -suffix.length);
}

async function errorMessage(response) {
  const text = await response.text();
  if (!text) return response.statusText || 'Unknown error';
  try {
    const body = JSON.parse(text);
    return body.message ?? body.error ?? text;
  } catch {
    return text;
  }
}

async function managementRequest(fetchImpl, path, token, init, label) {
  let response;
  try {
    response = await fetchImpl(`${MANAGEMENT_API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error(`${label} request failed: ${error?.message ?? error}`);
  }

  if (!response.ok) {
    throw new Error(`${label} request failed (${response.status}): ${await errorMessage(response)}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getProjectStatus(fetchImpl, projectRef, token) {
  const project = await managementRequest(
    fetchImpl,
    `/projects/${projectRef}`,
    token,
    { method: 'GET' },
    'Supabase project status',
  );
  if (!project.status) throw new Error('Supabase project status response did not include status');
  return project.status;
}

async function restoreProject(fetchImpl, projectRef, token) {
  await managementRequest(
    fetchImpl,
    `/projects/${projectRef}/restore`,
    token,
    { method: 'POST' },
    'Supabase project restore',
  );
}

async function createDatabaseActivity(fetchImpl, supabaseUrl, serviceRoleKey, requestCount) {
  const url = `${supabaseUrl}/rest/v1/weeks?select=week&order=end_date.desc&limit=1`;
  for (let request = 1; request <= requestCount; request += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
        },
      });
    } catch (error) {
      throw new Error(`Supabase database health request failed: ${error?.message ?? error}`);
    }
    if (!response.ok) {
      throw new Error(
        `Supabase database health request failed (${response.status}): ${await errorMessage(response)}`,
      );
    }
  }
}

export async function ensureSupabaseActive({
  env = process.env,
  fetchImpl = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  log = console.log,
  maxStatusChecks = DEFAULT_STATUS_CHECKS,
  statusIntervalMs = DEFAULT_STATUS_INTERVAL_MS,
  activityRequests = DEFAULT_ACTIVITY_REQUESTS,
} = {}) {
  const supabaseUrl = requireValue(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceRoleKey = requireValue(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = requireValue(env, 'SUPABASE_ACCESS_TOKEN');
  const projectRef = projectRefFromUrl(supabaseUrl);

  let status = await getProjectStatus(fetchImpl, projectRef, accessToken);
  let restored = false;
  log(`Supabase project ${projectRef} status: ${status}`);

  if (status === 'INACTIVE') {
    log(`Supabase project ${projectRef} is inactive; requesting restore.`);
    await restoreProject(fetchImpl, projectRef, accessToken);
    restored = true;
  }

  if (status !== 'ACTIVE_HEALTHY') {
    for (let check = 1; check <= maxStatusChecks; check += 1) {
      await sleep(statusIntervalMs);
      status = await getProjectStatus(fetchImpl, projectRef, accessToken);
      log(`Supabase health check ${check}/${maxStatusChecks}: ${status}`);
      if (status === 'ACTIVE_HEALTHY') break;
    }
  }

  if (status !== 'ACTIVE_HEALTHY') {
    throw new Error(
      `Supabase project did not become ACTIVE_HEALTHY after ${maxStatusChecks} checks (last status: ${status})`,
    );
  }

  await createDatabaseActivity(fetchImpl, supabaseUrl, serviceRoleKey, activityRequests);
  log(`Supabase database is reachable; completed ${activityRequests} activity requests.`);
  return { restored, status };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) {
  ensureSupabaseActive().catch((error) => {
    console.error(`Supabase availability check failed: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
