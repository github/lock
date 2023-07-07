# lock 🔒

[![test](https://github.com/github/lock/actions/workflows/test.yml/badge.svg)](https://github.com/github/lock/actions/workflows/test.yml) [![lint](https://github.com/github/lock/actions/workflows/lint.yml/badge.svg)](https://github.com/github/lock/actions/workflows/lint.yml) [![package-check](https://github.com/github/lock/actions/workflows/package-check.yml/badge.svg)](https://github.com/github/lock/actions/workflows/package-check.yml) [![CodeQL](https://github.com/github/lock/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/github/lock/actions/workflows/codeql-analysis.yml)

A standalone deployment locking Action to prevent multiple deployments from running at the same time

> If you came here from the [github/branch-deploy](https://github.com/github/branch-deploy) Action, you are in the right place!

## About 💡

Certain users for the [github/branch-deploy](https://github.com/github/branch-deploy) Action need more control over how, when, and why deployment locks are set. This Action allows you to have full control over when and how locks are set and removed.

### Potential Use Cases 🗒️

- Manually set a deployment lock via a workflow dispatch event
- Conditionally set a deployment lock if your test suite is failing badly
- Set a deployment lock over all your repositories during an a scheduled deploy lock window
- Set a deployment lock via a comment on a pull request (supported out-of-the-box)

## Usage 🚀

This section goes into detail on how you can use this Action in your own workflows!

## Inputs 📥

| Input | Required? | Default | Description |
| ----- | --------- | ------- | ----------- |
| `github_token` | `true` | `${{ github.token }}` | The GitHub token used to create an authenticated client - Provided for you by default! |
| `environment` | `true` | `"production"` | The explict environment to apply locking actions to when running in headless mode - OR the default environment to use when running in the context of IssueOps commands in a comment - Examples: production, development, etc - Use "global" for the global lock environment |
| `environment_targets` | `false` | `"production,development,staging"` | Optional (or additional) target environments to select for use with lock/unlock. Example, "production,development,staging". Example  usage: `.lock development`, `.lock production`, `.unlock staging` |
| `reaction` | `false` | `eyes` | If set, the specified emoji "reaction" is put on the comment to indicate that the trigger was detected. For example, "rocket" or "eyes" |
| `lock_trigger` | `false` | `.lock` | The string to look for in comments as an IssueOps lock trigger. Used for locking branch deployments on a specific branch. Example: "lock" |
| `unlock_trigger` | `false` | `.unlock` | The string to look for in comments as an IssueOps unlock trigger. Used for unlocking branch deployments. Example: "unlock" |
| `lock_info_alias` | `false` | `.wcid` | An alias or shortcut to get details about the current lock (if it exists) Example: ".info" - Hubbers will find the ".wcid" default helpful ("where can I deploy") |
| `global_lock_flag` | `false` | `--global` | The flag to pass into the lock command to lock all environments on IssueOps commands in comments. Example: "--global" |
| `prefix_only` | `false` | `"true"` | If "false", the trigger can match anywhere in the comment |
| `mode` | `false` | - | The mode to use "lock", "unlock", or "check". If not provided, the default mode assumes the workflow is not headless and triggered by a comment on a pull request - Example: .lock / .unlock

### About the `mode` Input

If you wish to use this Action via a comment on a pull request, simply omit the `mode` input. If you wish to use this Action via a workflow dispatch event, conditially in a custom workflow, or otherwise, you must provide the `mode` input. You are telling the Action what "mode" to use. The `mode` input can be either `lock`, `unlock`, or `check`.

## Outputs 📤

| Output | Description |
| ------ | ----------- |
| `triggered` | The string "true" if the trigger was found, otherwise the string "false" |
| `comment_id` | The comment id which triggered this deployment |
| `type` | The type of trigger which was found - 'lock', 'unlock', or 'info-info-alias' |
| `comment_body` | The comment body which triggered this action (if it was not headless) |
| `headless` | The string "true" if the run was headless, otherwise the string "false" - Headless in this context would be if the "mode" was set and the Action was not invoked by a comment on a pull request |
| `locked` | If the "mode" is set to "check", this output is exported to show if the lock is set in a headless run |
| `branch` | If the mode is set to "check", this output will be the branch name that holds the lock, otherwise it will be empty |
| `created_by` | If the mode is set to "check", this output will be the user that holds the lock, otherwise it will be empty |
| `created_at` | If the mode is set to "check", this output will be the ISO 8601 format date that the lock was claimed, otherwise it will be empty |
| `reason` | If the mode is set to "check", this output will be the reason the deployment lock was claimed, otherwise it will be empty |
| `link` | If the mode is set to "check", this output will be the link to the GitHub issue comment or action run that claimed the lock, otherwise it will be empty |
| `global_lock_claimed` | The string "true" if the global lock was claimed |
| `global_lock_released` | The string "true" if the global lock was released |
| `lock_environment` | When running in headless mode and the "mode" is set to "check", this output will be the environment name that holds the lock, otherwise it will be empty |

## Examples 📖

> Where `vX.X.X` is the latest version of this Action

### Setting a Lock via an IssueOps Trigger (comment on a pull request)

```yaml
name: lock-or-unlock

on:
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  contents: write

jobs:
  lock-or-unlock:
    if: ${{ github.event.issue.pull_request }} # only run on pull request comments
    runs-on: ubuntu-latest
    steps:
      # Lock or Unlock via a comment (ex: .lock or .unlock)
      - uses: github/lock@vX.X.X
        id: lock
```

### Setting a Lock via a Workflow Dispatch Event

```yaml
name: lock-dispatch

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for claiming the deployment lock'
        required: false
      environment:
        description: 'The environment to claim a lock for (production, staging, etc) - global is supported to claim the special global lock)'
        required: true
        default: 'production'
      mode:
        description: 'The mode to use: check, lock, unlock'
        required: true
        default: 'lock'

permissions:
  contents: write

jobs:
  lock:
    runs-on: ubuntu-latest
    steps:
      - uses: github/lock@vX.X.X
        id: lock
        with:
          mode: ${{ github.event.inputs.mode }}
          reason: ${{ github.event.inputs.reason }}
          environment: ${{ github.event.inputs.environment }}
```

### Removing a Lock via a Workflow Dispatch Event

```yaml
name: unlock

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  unlock:
    runs-on: ubuntu-latest
    steps:
      # Unlock
      - uses: github/lock@vX.X.X
        id: lock
        with:
          mode: "unlock"
```

### Setting a Lock Conditionally (basic example)

```yaml
name: lock (basic example)

# on: (some event)

permissions:
  contents: write

jobs:
  lock:
    runs-on: ubuntu-latest
    steps:

      # if something occurs, set the lock below

      # Unlock
      - uses: github/lock@vX.X.X
        id: lock
        with:
          mode: "lock"
```

### Checking if a Lock is Set (basic example) - headless

```yaml
name: lock-check

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  lock-check:
    runs-on: ubuntu-latest
    steps:
      - uses: github/lock@vX.X.X
        id: lock
        with:
          mode: check

      - name: Print lock status
        run: |
          echo "Lock status: ${{ steps.lock.outputs.locked }}"
```
