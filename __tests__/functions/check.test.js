import * as core from '@actions/core'
import {check} from '../../src/functions/check'

class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.status = 404
  }
}

const warningMock = jest.spyOn(core, 'warning')
const infoMock = jest.spyOn(core, 'info')
const setOutputMock = jest.spyOn(core, 'setOutput')

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(core, 'setFailed').mockImplementation(() => {})
  jest.spyOn(core, 'saveState').mockImplementation(() => {})
  jest.spyOn(core, 'warning').mockImplementation(() => {})
  jest.spyOn(core, 'info').mockImplementation(() => {})
  jest.spyOn(core, 'setOutput').mockImplementation(() => {})
})

const lockBase64Octocat =
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJsaW5rIjogImh0dHBzOi8vZ2l0aHViLmNvbS90ZXN0LW9yZy90ZXN0LXJlcG8vcHVsbC8yI2lzc3VlY29tbWVudC00NTYiCn0K'

const context = {
  repo: {
    owner: 'corp',
    repo: 'test'
  }
}

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

test('successfully checks for a lock and finds a lock', async () => {
  expect(await check(octokit, context)).toBe(true)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'true')
  expect(infoMock).toHaveBeenCalledWith('lock exists')
})

test('successfully checks for a lock and does not find a lock branch', async () => {
  octokit.rest.repos.getBranch = jest
    .fn()
    .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
  expect(await check(octokit, context)).toBe(false)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'false')
  expect(infoMock).toHaveBeenCalledWith('lock does not exist')
})

test('successfully checks for a lock and does not find a lock file', async () => {
  octokit.rest.repos.getContent = jest
    .fn()
    .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
  expect(await check(octokit, context)).toBe(false)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'false')
  expect(infoMock).toHaveBeenCalledWith('lock does not exist')
})

test('successfully checks for a lock but cannot decode the lock file', async () => {
  octokit.rest.repos.getContent = jest
    .fn()
    .mockReturnValue({data: {content: undefined}})
  expect(await check(octokit, context)).toBe(false)
  expect(warningMock).toHaveBeenCalledWith(
    'TypeError [ERR_INVALID_ARG_TYPE]: The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received undefined'
  )
  expect(warningMock).toHaveBeenCalledWith(
    'lock file exists, but cannot be decoded - setting locked to false'
  )
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'false')
})

test('handles an unexpected error', async () => {
  octokit.rest.repos.getContent = jest.fn().mockRejectedValueOnce(new Error())
  try {
    await check(octokit, context)
  } catch (e) {
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toBe('Error')
  }
})
