const assert = require('node:assert/strict');
const test = require('node:test');
const { assertProtectedEnvironment } = require('../scripts/lib/github-environment.cjs');

test('accepts an environment with reviewers and protected branches', () => {
  const result = assertProtectedEnvironment('base-mainnet', {
    protection_rules: [
      {
        type: 'required_reviewers',
        reviewers: [{ type: 'User', reviewer: { login: 'security-reviewer' } }],
      },
    ],
    deployment_branch_policy: {
      protected_branches: true,
      custom_branch_policies: false,
    },
  });
  assert.equal(result.reviewerCount, 1);
});

test('rejects an environment without required reviewers', () => {
  assert.throws(
    () =>
      assertProtectedEnvironment('base-mainnet', {
        protection_rules: [],
        deployment_branch_policy: {
          protected_branches: true,
          custom_branch_policies: false,
        },
      }),
    /deployment reviewer/
  );
});

test('rejects an environment without a branch restriction', () => {
  assert.throws(
    () =>
      assertProtectedEnvironment('base-mainnet', {
        protection_rules: [
          {
            type: 'required_reviewers',
            reviewers: [{ type: 'User', reviewer: { login: 'security-reviewer' } }],
          },
        ],
        deployment_branch_policy: null,
      }),
    /restrict deployment branches/
  );
});
