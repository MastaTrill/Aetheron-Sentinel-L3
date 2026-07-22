const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;

function assertImmutableRelease(release, expectedTag) {
  if (!TAG_PATTERN.test(expectedTag || '')) {
    throw new Error('RELEASE_TAG is invalid');
  }
  if (!release || release.tag_name !== expectedTag) {
    throw new Error('GitHub release tag does not match RELEASE_TAG');
  }
  if (release.draft || !release.published_at) {
    throw new Error('GitHub release must be published');
  }
  if (release.prerelease) {
    throw new Error('GitHub release must not be a prerelease');
  }
  if (release.immutable !== true) {
    throw new Error('GitHub release must be immutable');
  }
  return release;
}

async function resolveTagCommit(tagRef, expectedTag, loadTagObject) {
  if (tagRef?.ref !== `refs/tags/${expectedTag}`) {
    throw new Error('Git tag reference does not match RELEASE_TAG');
  }

  let object = tagRef.object;
  const visited = new Set();
  for (let depth = 0; depth < 8; depth += 1) {
    if (!object || !COMMIT_PATTERN.test(object.sha || '')) {
      throw new Error('Git tag contains an invalid object SHA');
    }
    if (object.type === 'commit') return object.sha.toLowerCase();
    if (object.type !== 'tag') {
      throw new Error(`Git tag points to unsupported object type: ${object.type || 'missing'}`);
    }
    if (visited.has(object.sha)) throw new Error('Git tag object cycle detected');
    visited.add(object.sha);
    const annotatedTag = await loadTagObject(object.sha);
    object = annotatedTag?.object;
  }
  throw new Error('Git tag annotation depth exceeds the supported limit');
}

function assertReleaseCommit(actualCommit, expectedCommit) {
  if (!COMMIT_PATTERN.test(expectedCommit || '')) {
    throw new Error('RELEASE_COMMIT must be a 40-character Git commit');
  }
  if (actualCommit !== expectedCommit.toLowerCase()) {
    throw new Error('Immutable release tag does not resolve to RELEASE_COMMIT');
  }
}

module.exports = {
  COMMIT_PATTERN,
  TAG_PATTERN,
  assertImmutableRelease,
  assertReleaseCommit,
  resolveTagCommit,
};
