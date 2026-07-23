const { assertProtectedEnvironment } = require('./lib/github-environment.cjs');

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const environmentName = process.env.DEPLOY_ENVIRONMENT;
  const token = process.env.GITHUB_TOKEN;
  const requireReviewers = process.env.REQUIRE_DEPLOYMENT_REVIEWERS !== 'false';

  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY is missing or invalid');
  }
  if (!environmentName) throw new Error('DEPLOY_ENVIRONMENT is missing');
  if (!token) throw new Error('GITHUB_TOKEN is missing');

  const response = await fetch(
    `https://api.github.com/repos/${repository}/environments/${encodeURIComponent(environmentName)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `Cannot validate GitHub environment ${environmentName}: HTTP ${response.status}`
    );
  }

  const result = assertProtectedEnvironment(environmentName, await response.json(), {
    requireReviewers,
  });
  console.log('GITHUB ENVIRONMENT: PASS');
  console.log(`Environment: ${result.environmentName}`);
  console.log(`Deployment reviewer required: ${result.requireReviewers}`);
  console.log(`Required reviewers: ${result.reviewerCount}`);
  console.log(`Deployment branch policy: ${JSON.stringify(result.branchPolicy)}`);
}

main().catch(error => {
  console.error('GITHUB ENVIRONMENT: FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
