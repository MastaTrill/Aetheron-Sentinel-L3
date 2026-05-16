## Environment Protection Rules (Recommended)

Go to:
**Settings → Environments → New environment**

Create these environments:

1. **staging**
   - Required reviewers: 1
   - Required status checks: All security & CI workflows

2. **production**
   - Required reviewers: 2
   - Wait timer: 30 minutes (optional)
   - Required status checks: All workflows
