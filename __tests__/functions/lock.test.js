import * as core from '@actions/core'
import {lock} from '../../src/functions/lock'
import * as actionStatus from '../../src/functions/action-status'

class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.status = 404
  }
}

class BigBadError extends Error {
  constructor(message) {
    super(message)
    this.status = 500
  }
}

const environment = 'production'

const lockBase64Monalisa =
  'ewogICAgInJlYXNvbiI6IG51bGwsCiAgICAiYnJhbmNoIjogImNvb2wtbmV3LWZlYXR1cmUiLAogICAgImNyZWF0ZWRfYXQiOiAiMjAyMi0wNi0xNVQyMToxMjoxNC4wNDFaIiwKICAgICJjcmVhdGVkX2J5IjogIm1vbmFsaXNhIiwKICAgICJzdGlja3kiOiBmYWxzZSwKICAgICJlbnZpcm9ubWVudCI6ICJwcm9kdWN0aW9uIiwKICAgICJ1bmxvY2tfY29tbWFuZCI6ICIudW5sb2NrIHByb2R1Y3Rpb24iLAogICAgImdsb2JhbCI6IGZhbHNlLAogICAgImxpbmsiOiAiaHR0cHM6Ly9naXRodWIuY29tL3Rlc3Qtb3JnL3Rlc3QtcmVwby9wdWxsLzMjaXNzdWVjb21tZW50LTEyMyIKfQo='

const lockBase64Octocat =
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJlbnZpcm9ubWVudCI6ICJwcm9kdWN0aW9uIiwKICAgICJ1bmxvY2tfY29tbWFuZCI6ICIudW5sb2NrIHByb2R1Y3Rpb24iLAogICAgImdsb2JhbCI6IGZhbHNlLAogICAgImxpbmsiOiAiaHR0cHM6Ly9naXRodWIuY29tL3Rlc3Qtb3JnL3Rlc3QtcmVwby9wdWxsLzIjaXNzdWVjb21tZW50LTQ1NiIKfQo='

const lockBase64OctocatGlobal =
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJlbnZpcm9ubWVudCI6IG51bGwsCiAgICAidW5sb2NrX2NvbW1hbmQiOiAiLnVubG9jayAtLWdsb2JhbCIsCiAgICAiZ2xvYmFsIjogdHJ1ZSwKICAgICJsaW5rIjogImh0dHBzOi8vZ2l0aHViLmNvbS90ZXN0LW9yZy90ZXN0LXJlcG8vcHVsbC8yI2lzc3VlY29tbWVudC00NTYiCn0K'

const setFailedMock = jest.spyOn(core, 'setFailed')
const infoMock = jest.spyOn(core, 'info')
const debugMock = jest.spyOn(core, 'debug')
const setOutputMock = jest.spyOn(core, 'setOutput')

var octokit
var actionStatusSpy

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(core, 'setFailed').mockImplementation(() => {})
  jest.spyOn(core, 'saveState').mockImplementation(() => {})
  jest.spyOn(core, 'setOutput').mockImplementation(() => {})
  jest.spyOn(core, 'info').mockImplementation(() => {})
  jest.spyOn(core, 'debug').mockImplementation(() => {})
  actionStatusSpy = jest
    .spyOn(actionStatus, 'actionStatus')
    .mockImplementation(() => {
      return undefined
    })
  process.env.INPUT_GLOBAL_LOCK_FLAG = '--global'
  process.env.INPUT_LOCK_TRIGGER = '.lock'
  process.env.INPUT_ENVIRONMENT = 'production'
  process.env.INPUT_LOCK_INFO_ALIAS = '.wcid'

  octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found'))
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
})

const context = {
  actor: 'monalisa',
  repo: {
    owner: 'corp',
    repo: 'test'
  },
  issue: {
    number: 1
  },
  payload: {
    comment: {
      body: '.lock'
    }
  }
}

const ref = 'cool-new-feature'

test('successfully obtains a deployment lock (non-sticky) by creating the branch and lock file', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found'))
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: true
  })
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
  )
})

test('Request detailsOnly on the lock file when no branch exists and hits an error when trying to check the branch', async () => {
  context.payload.comment.body = '.lock --details'
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new BigBadError('oh no - 500')),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found'))
      }
    }
  }
  try {
    await lock(octokit, context, ref, 123, null, environment, true)
  } catch (error) {
    expect(error.message).toBe('Error: oh no - 500')
    expect(debugMock).toHaveBeenCalledWith(`detected lock env: ${environment}`)
    expect(debugMock).toHaveBeenCalledWith(`detected lock global: false`)
    expect(debugMock).toHaveBeenCalledWith(
      `constructed lock branch: ${environment}-branch-deploy-lock`
    )
  }
})

test('successfully obtains a deployment lock (non-sticky) by creating the branch and lock file in headless mode', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found'))
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }

  expect(
    await lock(octokit, context, null, null, false, environment, false, true)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: true
  })
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
  )
  expect(setOutputMock).toHaveBeenCalledWith('headless', 'true')
})

test('Determines that another user has the lock and exits - during a lock claim on deployment', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      environment: 'production',
      global: false,
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
      reason: 'Testing my new feature with lots of cats',
      sticky: true,
      unlock_command: '.unlock production'
    },
    status: false
  })
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    expect.stringMatching(
      /Sorry __monalisa__, the `production` environment deployment lock is currently claimed by __octocat__/
    )
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    expect.stringMatching(
      /Sorry __monalisa__, the `production` environment deployment lock is currently claimed by __octocat__/
    )
  )
})

test('Determines that another user has the lock and exits - during a direct lock claim with .lock', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('file not found'))
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, true, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      environment: 'production',
      global: false,
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
      reason: 'Testing my new feature with lots of cats',
      sticky: true,
      unlock_command: '.unlock production'
    },
    status: false
  })
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    expect.stringMatching(
      /Sorry __monalisa__, the `production` environment deployment lock is currently claimed by __octocat__/
    )
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    expect.stringMatching(/Cannot claim deployment lock/)
  )
})

test('Determines that another user has the lock and exits - headless', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('file not found'))
          .mockReturnValueOnce({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, true, environment, false, true)
  ).toStrictEqual({
    status: false,
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      environment: 'production',
      global: false,
      sticky: true,
      unlock_command: '.unlock production',
      reason: 'Testing my new feature with lots of cats',
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456'
    }
  })
})

test('Request detailsOnly on the lock file and gets lock file data successfully', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('file not found'))
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment, true)
  ).toStrictEqual({
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
      reason: 'Testing my new feature with lots of cats',
      sticky: true,
      environment: environment,
      global: false,
      unlock_command: '.unlock production'
    },
    environment: environment,
    global: false,
    globalFlag: '--global',
    status: 'details-only'
  })
})

test('Request detailsOnly on the lock file when the lock branch exists but no lock file exists', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found')),
        createOrUpdateFileContents: jest.fn().mockReturnValue({})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment, true)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: null
  })
})

test('Request detailsOnly on the lock file when no branch exists', async () => {
  context.payload.comment.body = '.lock --details'
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found'))
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment, true)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: null
  })
})

test('Determines that the lock request is coming from current owner of the lock and exits - non-sticky', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValue({data: {content: lockBase64Monalisa}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: {
      branch: 'cool-new-feature',
      created_at: '2022-06-15T21:12:14.041Z',
      created_by: 'monalisa',
      environment: 'production',
      global: false,
      link: 'https://github.com/test-org/test-repo/pull/3#issuecomment-123',
      reason: null,
      sticky: false,
      unlock_command: '.unlock production'
    },
    status: 'owner'
  })
  expect(infoMock).toHaveBeenCalledWith('monalisa is the owner of the lock')
})

test('Determines that the lock request is coming from current owner of the lock and exits - sticky', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValue({data: {content: lockBase64Monalisa}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, true, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: {
      branch: 'cool-new-feature',
      created_at: '2022-06-15T21:12:14.041Z',
      created_by: 'monalisa',
      environment: 'production',
      global: false,
      link: 'https://github.com/test-org/test-repo/pull/3#issuecomment-123',
      reason: null,
      sticky: false,
      unlock_command: '.unlock production'
    },
    status: 'owner'
  })
  expect(infoMock).toHaveBeenCalledWith('monalisa is the owner of the lock')
})

test('Determines that the lock request is coming from current owner of the lock and exits - headless', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValue({data: {content: lockBase64Monalisa}})
      }
    }
  }
  expect(
    await lock(octokit, context, null, null, true, environment, false, true)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: {
      branch: 'cool-new-feature',
      created_at: '2022-06-15T21:12:14.041Z',
      created_by: 'monalisa',
      environment: 'production',
      global: false,
      link: 'https://github.com/test-org/test-repo/pull/3#issuecomment-123',
      reason: null,
      sticky: false,
      unlock_command: '.unlock production'
    },
    status: 'owner-headless'
  })
  expect(infoMock).toHaveBeenCalledWith('monalisa is the owner of the lock')
  expect(setOutputMock).toHaveBeenCalledWith('headless', 'true')
})

test('Creates a lock when the lock branch exists but no lock file exists', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found')),
        createOrUpdateFileContents: jest.fn().mockReturnValue({})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: true
  })
  expect(infoMock).toHaveBeenCalledWith('deployment lock obtained')
})

test('successfully obtains a deployment lock (sticky) by creating the branch and lock file - with a --reason', async () => {
  context.payload.comment.body =
    '.lock --reason testing a super cool new feature'
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found'))
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, true, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: true
  })
  expect(infoMock).toHaveBeenCalledWith('deployment lock obtained')
  expect(infoMock).toHaveBeenCalledWith('deployment lock is sticky')
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
  )
})

test('successfully obtains a deployment lock (sticky) by creating the branch and lock file - with an empty --reason', async () => {
  context.payload.comment.body = '.lock --reason'
  expect(
    await lock(octokit, context, ref, 123, true, environment)
  ).toStrictEqual({
    environment: 'production',
    global: false,
    globalFlag: '--global',
    lockData: null,
    status: true
  })
  expect(infoMock).toHaveBeenCalledWith('deployment lock obtained')
  expect(infoMock).toHaveBeenCalledWith('deployment lock is sticky')
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
  )
})

test('Determines that the lock request is coming from current owner of the lock (GLOBAL lock) and exits - sticky', async () => {
  context.actor = 'octocat'
  context.payload.comment.body = '.lock --global'
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValue({data: {content: lockBase64OctocatGlobal}})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, true, 'global')).toStrictEqual({
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
      reason: 'Testing my new feature with lots of cats',
      sticky: true,
      environment: null,
      global: true,
      unlock_command: '.unlock --global'
    },
    status: 'owner',
    global: true,
    globalFlag: '--global',
    environment: 'global'
  })
  expect(debugMock).toHaveBeenCalledWith(`detected lock env: global`)
  expect(debugMock).toHaveBeenCalledWith(`detected lock global: true`)
  expect(debugMock).toHaveBeenCalledWith(
    `constructed lock branch: global-branch-deploy-lock`
  )
  expect(infoMock).toHaveBeenCalledWith('octocat is the owner of the lock')
})

test('Request detailsOnly on the lock file and gets lock file data successfully -- .wcid --global', async () => {
  context.payload.comment.body = '.wcid --global'

  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValueOnce({data: {content: lockBase64OctocatGlobal}}) // succeeds looking for a global lock
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, 'global', true, false)
  ).toStrictEqual({
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      environment: null,
      global: true,
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
      reason: 'Testing my new feature with lots of cats',
      sticky: true,
      unlock_command: '.unlock --global'
    },
    status: 'details-only',
    environment: 'global',
    globalFlag: '--global',
    global: true
  })
  expect(debugMock).toHaveBeenCalledWith(`detected lock env: global`)
  expect(debugMock).toHaveBeenCalledWith(`detected lock global: true`)
  expect(debugMock).toHaveBeenCalledWith(
    `constructed lock branch: global-branch-deploy-lock`
  )
})

test('Request detailsOnly on the lock file and does not find a lock -- .wcid --global', async () => {
  context.payload.comment.body = '.wcid --global'

  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('branch not found')),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockRejectedValue(new NotFoundError('file not found')) // fails looking for a global lock
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, 'global', true, false)
  ).toStrictEqual({
    lockData: null,
    status: null,
    environment: 'global',
    globalFlag: '--global',
    global: true
  })
  expect(debugMock).toHaveBeenCalledWith(`detected lock env: global`)
  expect(debugMock).toHaveBeenCalledWith(`detected lock global: true`)
  expect(debugMock).toHaveBeenCalledWith(
    `constructed lock branch: global-branch-deploy-lock`
  )
})

test('Determines that another user has the lock (GLOBAL) and exits - during a direct lock claim with .lock --global', async () => {
  context.payload.comment.body = '.lock --global'
  context.actor = 'monalisa'
  const actionStatusSpy = jest
    .spyOn(actionStatus, 'actionStatus')
    .mockImplementation(() => {
      return undefined
    })
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValueOnce({data: {content: lockBase64OctocatGlobal}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, true, 'global', false, false)
  ).toStrictEqual({
    lockData: {
      branch: 'octocats-everywhere',
      created_at: '2022-06-14T21:12:14.041Z',
      created_by: 'octocat',
      environment: null,
      global: true,
      link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
      reason: 'Testing my new feature with lots of cats',
      sticky: true,
      unlock_command: '.unlock --global'
    },
    status: false,
    globalFlag: '--global',
    environment: 'global',
    global: true
  })
  expect(debugMock).toHaveBeenCalledWith(`detected lock env: global`)
  expect(debugMock).toHaveBeenCalledWith(`detected lock global: true`)
  expect(debugMock).toHaveBeenCalledWith(
    `constructed lock branch: global-branch-deploy-lock`
  )
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    expect.stringMatching(
      /Sorry __monalisa__, the `global` deployment lock is currently claimed by __octocat__/
    )
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    expect.stringMatching(/Cannot claim deployment lock/)
  )
})

test('successfully obtains a GLOBAL deployment lock (sticky) by creating the branch and lock file', async () => {
  const octokit = {
    rest: {
      repos: {
        getBranch: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        createOrUpdateFileContents: jest.fn().mockReturnValue({}),
        getContent: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError('file not found'))
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, true, 'global')).toStrictEqual({
    environment: 'global',
    global: true,
    globalFlag: '--global',
    lockData: null,
    status: true
  })
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: global-branch-deploy-lock'
  )
})

test('throws an error if an unhandled exception occurs', async () => {
  octokit.rest.repos.getBranch = jest
    .fn()
    .mockRejectedValueOnce(new Error('oh no'))
  octokit.rest.repos.getContent = jest
    .fn()
    .mockRejectedValue(new Error('oh no'))

  try {
    await lock(octokit, context, ref, 123, true, environment)
  } catch (e) {
    expect(e.message).toBe('Error: oh no')
  }
})
