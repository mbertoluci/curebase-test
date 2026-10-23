# Branch protection - preventing merges without an approved PR

`main` should be mergeable **only** through a pull request that is reviewed and
green. These rules are applied through the GitHub API (not committed state), so
they must be enabled once per repository by someone with admin on it.

## What the rules enforce

- **No direct pushes to `main`** - changes land via PR only.
- **≥ 1 approving review**, from a **Code Owner** (see `.github/CODEOWNERS`).
- **Stale approvals dismissed** when new commits are pushed.
- **Required status check `verify`** (the CI job) must pass, and the branch must
  be **up to date** with `main` before merging (`strict`).
- **Linear history**, **no force-pushes**, **no branch deletion**.
- **All PR conversations resolved** before merge.

## Apply it

With the GitHub CLI authenticated as a user who **admins this repo**:

```bash
gh api -X PUT \
  repos/mbertoluci/curebase-test/branches/main/protection \
  --input .github/branch-protection.json
```

(If you rename the repo, update the `repos/<owner>/<name>` path.)

Verify:

```bash
gh api repos/mbertoluci/curebase-test/branches/main/protection | jq .
```

## Notes

- **Solo repo caveat:** GitHub does not let you approve your own PR, so with
  `required_approving_review_count: 1` you need a second collaborator to approve
  (invite the interviewers as collaborators, or temporarily set the count to `0`
  while working solo). `enforce_admins` is left `false` so an admin can still
  administer the branch.
- **Rulesets alternative:** the same can be expressed as a repository _ruleset_
  (`repos/<owner>/<name>/rulesets`), which also covers private repos on the free
  plan. The classic branch-protection payload above is kept for its simplicity.
