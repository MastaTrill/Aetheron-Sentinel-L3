const { githubJson } = require('./lib/github-api.cjs');
const {
  assertImmutableRelease,
  assertReleaseCommit,
  resolveTagCommit,
} = require('./lib/immutable-release.cjs');

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const releaseTag = process.env.RELEASE_TAG;
  const releaseCommit = process.env.RELEASE_COMMIT;

  const release = await githubJson(
    repository,
    token,
    `/releases/tags/${encodeURIComponent(releaseTag || '')}`,
    'Cannot load the requested GitHub release'
  );
  assertImmutableRelease(release, releaseTag);

  const tagRef = await githubJson(
    repository,
    token,
    `/git/ref/tags/${encodeURIComponent(releaseTag)}`,
    'Cannot load the requested Git tag'
  );
  const tagCommit = await resolveTagCommit(tagRef, releaseTag, sha =>
    githubJson(repository, token, `/git/tags/${sha}`, 'Cannot resolve annotated Git tag')
  );
  assertReleaseCommit(tagCommit, releaseCommit);

  console.log('IMMUTABLE RELEASE: PASS');
  console.log(`Release tag: ${releaseTag}`);
  console.log(`Release commit: ${tagCommit}`);
  console.log(`GitHub release: ${release.html_url}`);
}

main().catch(error => {
  console.error('IMMUTABLE RELEASE: FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
