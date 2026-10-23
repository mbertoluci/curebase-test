# Branch protection - preventing merges without a PR

`main` is mergeable **only** through a pull request that is green. These rules
are applied through the GitHub API (not committed state), so they must be
enabled once per repository by someone with admin on it.

## What the rules enforce

- **No direct pushes to `main`** - changes land via PR only.
- **Required status check `verify`** (the CI job) must pass, and the branch must
  be **up to date** with `main` before merging (`strict`).
- **Linear history**, **no force-pushes**, **no branch deletion**.
- **All PR conversations resolved** before merge.
- **No approval required** (`required_approving_review_count: 0`) so a solo
  maintainer can self-merge a green PR. `.github/CODEOWNERS` still auto-requests
  review on every PR; it just doesn't block.

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

- **Requiring approvals later:** to demand a reviewed PR once collaborators are
  on board, set `required_approving_review_count` to `1` and
  `require_code_owner_reviews` to `true` in `branch-protection.json`, then
  re-apply. (GitHub does not let you approve your own PR, so with `1` you need a
  second collaborator - invite the interviewers.)
- **Admin escape hatch:** `enforce_admins` is `false`, so an admin can still push
  directly or administer the branch if needed; set it `true` to force everyone,
  admins included, through the PR + CI flow.
- **Rulesets alternative:** the same can be expressed as a repository _ruleset_
  (`repos/<owner>/<name>/rulesets`), which also covers private repos on the free
  plan. The classic branch-protection payload above is kept for its simplicity.
