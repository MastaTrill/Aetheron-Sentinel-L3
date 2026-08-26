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
  assert.equal(result.requireReviewers, true);
});

test('rejects an environment without required reviewers by default', () => {
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

test('allows a readiness-only environment without reviewers', () => {
  const result = assertProtectedEnvironment(
    'base-sepolia',
    {
      protection_rules: [],
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    },
    { requireReviewers: false }
  );

  assert.equal(result.reviewerCount, 0);
  assert.equal(result.requireReviewers, false);
});

test('rejects an environment without a branch restriction', () => {
  assert.throws(
    () =>
      assertProtectedEnvironment(
        'base-sepolia',
        {
          protection_rules: [],
          deployment_branch_policy: null,
        },
        { requireReviewers: false }
      ),
    /restrict deployment branches/
  );
});
