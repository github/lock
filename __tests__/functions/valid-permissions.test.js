import {validPermissions} from '../../src/functions/valid-permissions'

beforeEach(() => {
  jest.clearAllMocks()
})

const context = {
  actor: 'octocat',
  repo: {
    owner: 'corp',
    repo: 'test'
  }
}

const octokit = {
  rest: {
    repos: {
      getCollaboratorPermissionLevel: jest
        .fn()
        .mockReturnValue({data: {permission: 'admin'}, status: 200})
    }
  }
}

test('successfully checks permissions and finds that they are valid', async () => {
  expect(await validPermissions(octokit, context)).toBe(true)
})

test('successfully checks permissions and finds that they are invalid', async () => {
  octokit.rest.repos.getCollaboratorPermissionLevel = jest
    .fn()
    .mockReturnValue({data: {permission: 'read'}, status: 200})
  expect(await validPermissions(octokit, context)).toBe(
    '👋 __octocat__, seems as if you have not admin/write permissions in this repo, permissions: read'
  )
})

test('tries to check permissions and gets a non-200 status code', async () => {
  octokit.rest.repos.getCollaboratorPermissionLevel = jest
    .fn()
    .mockReturnValue({data: {permission: 'admin'}, status: 500})
  expect(await validPermissions(octokit, context)).toBe(
    'Permission check returns non-200 status: 500'
  )
})
