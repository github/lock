import * as core from '@actions/core'
import {lock} from '../../src/functions/lock'
import * as actionStatus from '../../src/functions/action-status'

class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.status = 404
  }
}

const lockBase64Monalisa =
  'ewogICAgInJlYXNvbiI6IG51bGwsCiAgICAiYnJhbmNoIjogImNvb2wtbmV3LWZlYXR1cmUiLAogICAgImNyZWF0ZWRfYXQiOiAiMjAyMi0wNi0xNVQyMToxMjoxNC4wNDFaIiwKICAgICJjcmVhdGVkX2J5IjogIm1vbmFsaXNhIiwKICAgICJzdGlja3kiOiBmYWxzZSwKICAgICJlbnZpcm9ubWVudCI6ICJwcm9kdWN0aW9uIiwKICAgICJ1bmxvY2tfY29tbWFuZCI6ICIudW5sb2NrIHByb2R1Y3Rpb24iLAogICAgImdsb2JhbCI6IGZhbHNlLAogICAgImxpbmsiOiAiaHR0cHM6Ly9naXRodWIuY29tL3Rlc3Qtb3JnL3Rlc3QtcmVwby9wdWxsLzMjaXNzdWVjb21tZW50LTEyMyIKfQo='

const lockBase64Octocat =
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJlbnZpcm9ubWVudCI6ICJwcm9kdWN0aW9uIiwKICAgICJ1bmxvY2tfY29tbWFuZCI6ICIudW5sb2NrIHByb2R1Y3Rpb24iLAogICAgImdsb2JhbCI6IGZhbHNlLAogICAgImxpbmsiOiAiaHR0cHM6Ly9naXRodWIuY29tL3Rlc3Qtb3JnL3Rlc3QtcmVwby9wdWxsLzIjaXNzdWVjb21tZW50LTQ1NiIKfQo='

const lockBase64OctocatGlobal =
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJlbnZpcm9ubWVudCI6IG51bGwsCiAgICAidW5sb2NrX2NvbW1hbmQiOiAiLnVubG9jayAtLWdsb2JhbCIsCiAgICAiZ2xvYmFsIjogdHJ1ZSwKICAgICJsaW5rIjogImh0dHBzOi8vZ2l0aHViLmNvbS90ZXN0LW9yZy90ZXN0LXJlcG8vcHVsbC8yI2lzc3VlY29tbWVudC00NTYiCn0K'

const saveStateMock = jest.spyOn(core, 'saveState')
const setFailedMock = jest.spyOn(core, 'setFailed')
const infoMock = jest.spyOn(core, 'info')
const setOutputMock = jest.spyOn(core, 'setOutput')
const actionStatusSpy = jest
  .spyOn(actionStatus, 'actionStatus')
  .mockImplementation(() => {
    return undefined
  })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(core, 'setFailed').mockImplementation(() => {})
  jest.spyOn(core, 'saveState').mockImplementation(() => {})
  jest.spyOn(core, 'info').mockImplementation(() => {})
  jest.spyOn(core, 'setOutput').mockImplementation(() => {})
})

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
        .mockReturnValue({data: {content: lockBase64Octocat}})
    },
    git: {
      createRef: jest.fn().mockReturnValue({status: 201})
    },
    issues: {
      createComment: jest.fn().mockReturnValue({})
    }
  }
}

const environment = 'production'

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
      body: '.lock',
      id: 123
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
        createOrUpdateFileContents: jest.fn().mockReturnValue({})
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, false, environment)).toBe(true)
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
  )
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
        createOrUpdateFileContents: jest.fn().mockReturnValue({})
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
  ).toBe(true)
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
          .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}),
        get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
        getContent: jest
          .fn()
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, false, environment)).toBe(false)
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    expect.stringMatching(
      /Sorry __monalisa__, the deployment lock is currently claimed by __octocat__/
    )
  )
  expect(saveStateMock).toHaveBeenCalledWith('bypass', 'true')
  expect(setFailedMock).toHaveBeenCalledWith(
    expect.stringMatching(
      /Sorry __monalisa__, the deployment lock is currently claimed by __octocat__/
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
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, true, environment)).toBe(false)
  expect(actionStatusSpy).toHaveBeenCalledWith(
    context,
    octokit,
    123,
    expect.stringMatching(
      /Sorry __monalisa__, the deployment lock is currently claimed by __octocat__/
    )
  )
  expect(saveStateMock).toHaveBeenCalledWith('bypass', 'true')
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
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, true, environment, false, true)
  ).toBe(false)
  // expect(saveStateMock).toHaveBeenCalledWith('bypass', 'true')
  expect(infoMock).toHaveBeenCalledWith(
    expect.stringMatching(/The current lock has been active/)
  )
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
          .mockReturnValue({data: {content: lockBase64Octocat}})
      }
    }
  }
  expect(
    await lock(octokit, context, ref, 123, false, environment, true)
  ).toStrictEqual({
    branch: 'octocats-everywhere',
    created_at: '2022-06-14T21:12:14.041Z',
    created_by: 'octocat',
    link: 'https://github.com/test-org/test-repo/pull/2#issuecomment-456',
    reason: 'Testing my new feature with lots of cats',
    sticky: true,
    environment: environment,
    global: false,
    unlock_command: '.unlock production'
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
  expect(await lock(octokit, context, ref, 123, false, environment, true)).toBe(
    null
  )
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
        createOrUpdateFileContents: jest.fn().mockReturnValue({})
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, false, environment, true)).toBe(
    null
  )
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
  expect(await lock(octokit, context, ref, 123, false, environment)).toBe(
    'owner'
  )
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
  expect(await lock(octokit, context, ref, 123, true, environment)).toBe(
    'owner'
  )
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
  ).toBe('owner - headless')
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
  expect(await lock(octokit, context, ref, 123, false, environment)).toBe(true)
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
        createOrUpdateFileContents: jest.fn().mockReturnValue({})
      },
      git: {
        createRef: jest.fn().mockReturnValue({status: 201})
      },
      issues: {
        createComment: jest.fn().mockReturnValue({})
      }
    }
  }
  expect(await lock(octokit, context, ref, 123, true, environment)).toBe(true)
  expect(infoMock).toHaveBeenCalledWith('deployment lock obtained')
  expect(infoMock).toHaveBeenCalledWith('deployment lock is sticky')
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
  )
})

test('successfully obtains a deployment lock (sticky) by creating the branch and lock file - with an empty --reason', async () => {
  context.payload.comment.body = '.lock --reason'
  expect(await lock(octokit, context, ref, 123, true, environment)).toBe(true)
  expect(infoMock).toHaveBeenCalledWith('deployment lock obtained')
  expect(infoMock).toHaveBeenCalledWith('deployment lock is sticky')
  expect(infoMock).toHaveBeenCalledWith(
    'Created lock branch: production-branch-deploy-lock'
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
