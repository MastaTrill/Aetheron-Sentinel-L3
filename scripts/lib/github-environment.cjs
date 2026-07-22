function assertProtectedEnvironment(environmentName, environment) {
  const rules = Array.isArray(environment?.protection_rules) ? environment.protection_rules : [];
  const reviewerRule = rules.find(rule => rule.type === 'required_reviewers');
  if (!reviewerRule || !Array.isArray(reviewerRule.reviewers) || reviewerRule.reviewers.length === 0) {
    throw new Error(`${environmentName} must require at least one deployment reviewer`);
  }

  const branchPolicy = environment?.deployment_branch_policy;
  if (!branchPolicy?.protected_branches && !branchPolicy?.custom_branch_policies) {
    throw new Error(`${environmentName} must restrict deployment branches`);
  }

  return {
    environmentName,
    reviewerCount: reviewerRule.reviewers.length,
    branchPolicy,
  };
}

module.exports = { assertProtectedEnvironment };
