const API_VERSION = '2026-03-10';

function githubHeaders(token) {
  if (!token) throw new Error('GITHUB_TOKEN is missing');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  };
}

function githubUrl(repository, apiPath) {
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is missing or invalid');
  }
  if (!apiPath.startsWith('/')) throw new Error('GitHub API path must start with /');
  return `https://api.github.com/repos/${repository}${apiPath}`;
}

async function githubRequest(repository, token, apiPath, label) {
  const response = await fetch(githubUrl(repository, apiPath), {
    headers: githubHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`${label}: GitHub API returned HTTP ${response.status}`);
  }
  return response;
}

async function githubJson(repository, token, apiPath, label) {
  const response = await githubRequest(repository, token, apiPath, label);
  return response.json();
}

module.exports = {
  API_VERSION,
  githubHeaders,
  githubJson,
  githubUrl,
};
