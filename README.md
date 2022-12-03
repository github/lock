# lock 🔒

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
| github_token | yes | ${{ github.token }} | The GitHub token used to create an authenticated client - Provided for you by default! |
| reaction | no | eyes | If set, the specified emoji "reaction" is put on the comment to indicate that the trigger was detected. For example, "rocket" or "eyes" |
| lock_trigger | no | .lock | The string to look for in comments as an IssueOps lock trigger. Used for locking branch deployments on a specific branch. Example: "lock" |
| unlock_trigger | no | .unlock | The string to look for in comments as an IssueOps unlock trigger. Used for unlocking branch deployments. Example: "unlock" |
| lock_info_alias | no | .wcid | An alias or shortcut to get details about the current lock (if it exists) Example: ".info" - Hubbers will find the ".wcid" default helpful ("where can I deploy") |
| prefix_only | no | true | If "false", the trigger can match anywhere in the comment |
| mode | no | - | The mode to use "lock", "unlock", or "check". If not provided, the default mode assumes the workflow is not headless and triggered by a comment on a pull request - Example: .lock / .unlock

### About the `mode` Input

If you wish to use this Action via a comment on a pull request, simply omit the `mode` input. If you wish to use this Action via a workflow dispatch event, conditially in a custom workflow, or otherwise, you must provide the `mode` input. You are telling the Action what "mode" to use. The `mode` input can be either `lock` or `unlock`.

## Outputs 📤

| Output | Description |
| ------ | ----------- |
| triggered | The string "true" if the trigger was found, otherwise the string "false" |
| comment_id | The comment id which triggered this deployment |
| headless | The string "true" if the run was headless, otherwise the string "false" - Headless in this context would be if the "mode" was set and the Action was not invoked by a comment on a pull request |
| locked | If the 'mode' is set to 'check', this output is exported to show if the lock is set in a headless run |

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
name: lock

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for claiming the deployment lock for this repository'
        required: false

permissions:
  contents: write

jobs:
  lock:
    runs-on: ubuntu-latest
    steps:
      # Need to checkout for testing the Action in this repo
      - uses: actions/checkout@2541b1294d2704b0964813337f33b291d3f8596b # pin@v3.0.2

      # Lock
      - uses: github/lock@vX.X.X
        id: lock
        with:
          mode: "lock"
          reason: ${{ github.event.inputs.reason }}
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
