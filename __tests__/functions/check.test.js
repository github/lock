/* eslint-disable no-extra-semi */
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
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJlbnZpcm9ubWVudCI6ICJwcm9kdWN0aW9uIiwKICAgICJ1bmxvY2tfY29tbWFuZCI6ICIudW5sb2NrIHByb2R1Y3Rpb24iLAogICAgImdsb2JhbCI6IGZhbHNlLAogICAgImxpbmsiOiAiaHR0cHM6Ly9naXRodWIuY29tL3Rlc3Qtb3JnL3Rlc3QtcmVwby9wdWxsLzIjaXNzdWVjb21tZW50LTQ1NiIKfQo='

const lockBase64OctocatGlobal =
  'ewogICAgInJlYXNvbiI6ICJUZXN0aW5nIG15IG5ldyBmZWF0dXJlIHdpdGggbG90cyBvZiBjYXRzIiwKICAgICJicmFuY2giOiAib2N0b2NhdHMtZXZlcnl3aGVyZSIsCiAgICAiY3JlYXRlZF9hdCI6ICIyMDIyLTA2LTE0VDIxOjEyOjE0LjA0MVoiLAogICAgImNyZWF0ZWRfYnkiOiAib2N0b2NhdCIsCiAgICAic3RpY2t5IjogdHJ1ZSwKICAgICJlbnZpcm9ubWVudCI6IG51bGwsCiAgICAidW5sb2NrX2NvbW1hbmQiOiAiLnVubG9jayAtLWdsb2JhbCIsCiAgICAiZ2xvYmFsIjogdHJ1ZSwKICAgICJsaW5rIjogImh0dHBzOi8vZ2l0aHViLmNvbS90ZXN0LW9yZy90ZXN0LXJlcG8vcHVsbC8yI2lzc3VlY29tbWVudC00NTYiCn0K'

const context = {
  repo: {
    owner: 'corp',
    repo: 'test'
  }
}

const environment = 'production'

const octokit = {
  rest: {
    repos: {
      getBranch: jest
        .fn()
        .mockRejectedValueOnce(new NotFoundError('Reference does not exist')) // no global lock
        .mockReturnValueOnce({data: {commit: {sha: 'abc123'}}}), // global lock
      get: jest.fn().mockReturnValue({data: {default_branch: 'main'}}),
      getContent: jest
        .fn()
        .mockReturnValue({data: {content: lockBase64Octocat}})
    }
  }
}

test('successfully checks for a production lock and finds a lock', async () => {
  expect(await check(octokit, context, environment)).toBe(true)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'true')
  expect(setOutputMock).toHaveBeenCalledWith('lock_environment', environment)
  expect(setOutputMock).toHaveBeenCalledWith('created_by', 'octocat')
  expect(setOutputMock).toHaveBeenCalledWith(
    'created_at',
    '2022-06-14T21:12:14.041Z'
  )
  expect(setOutputMock).toHaveBeenCalledWith(
    'reason',
    'Testing my new feature with lots of cats'
  )
  expect(setOutputMock).toHaveBeenCalledWith(
    'link',
    'https://github.com/test-org/test-repo/pull/2#issuecomment-456'
  )
  expect(infoMock).toHaveBeenCalledWith('global lock does not exist')
  expect(infoMock).toHaveBeenCalledWith('production lock exists')
})

test('successfully checks for a production lock and does not find a lock branch', async () => {
  octokit.rest.repos.getBranch = jest
    .fn()
    .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
    .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
  expect(await check(octokit, context, environment)).toBe(false)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'false')
  expect(infoMock).toHaveBeenCalledWith('global lock does not exist')
  expect(infoMock).toHaveBeenCalledWith('production lock does not exist')
})

test('successfully checks for a production lock and finds a global lock instead', async () => {
  ;(octokit.rest.repos.getBranch = jest
    .fn()
    .mockReturnValueOnce({data: {commit: {sha: 'cba123'}}})), // global lock
    (octokit.rest.getContent = jest
      .fn()
      .mockReturnValue({data: {content: lockBase64OctocatGlobal}}))
  expect(await check(octokit, context, environment)).toBe(true)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'true')
  expect(setOutputMock).toHaveBeenCalledWith('lock_environment', 'global')
  expect(setOutputMock).toHaveBeenCalledWith('created_by', 'octocat')
  expect(setOutputMock).toHaveBeenCalledWith(
    'created_at',
    '2022-06-14T21:12:14.041Z'
  )
  expect(setOutputMock).toHaveBeenCalledWith(
    'reason',
    'Testing my new feature with lots of cats'
  )
  expect(setOutputMock).toHaveBeenCalledWith(
    'link',
    'https://github.com/test-org/test-repo/pull/2#issuecomment-456'
  )
  expect(infoMock).toHaveBeenCalledWith('global lock exists')
})

test('successfully checks for a global lock and does not find one', async () => {
  ;(octokit.rest.repos.getBranch = jest
    .fn()
    .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))), // global lock
    expect(await check(octokit, context, 'global')).toBe(false)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'false')
  expect(infoMock).toHaveBeenCalledWith('global lock does not exist')
})

test('successfully checks for a production lock and does not find a lock file', async () => {
  octokit.rest.repos.getContent = jest
    .fn()
    .mockRejectedValueOnce(new NotFoundError('Reference does not exist'))
  expect(await check(octokit, context, environment)).toBe(false)
  expect(setOutputMock).toHaveBeenCalledWith('locked', 'false')
  expect(infoMock).toHaveBeenCalledWith('global lock does not exist')
  expect(infoMock).toHaveBeenCalledWith('production lock does not exist')
})

test('successfully checks for a production lock but cannot decode the lock file', async () => {
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
