import {extractProperty} from '../utils'

// ===================================================================

export async function set (params) {
  const pool = extractProperty(params, 'pool')

  await this.getXAPI(pool).setPoolProperties(params)
}

set.params = {
  id: {
    type: 'string'
  },
  name_label: {
    type: 'string',
    optional: true
  },
  name_description: {
    type: 'string',
    optional: true
  }
}

set.resolve = {
  pool: ['id', 'pool', 'administrate']
}

// -------------------------------------------------------------------

export async function installPatch ({pool, patch: patchUuid}) {
  await this.getXAPI(pool).installPoolPatchOnAllHosts(patchUuid)
}

installPatch.params = {
  pool: {
    type: 'string'
  },
  patch: {
    type: 'string'
  }
}

installPatch.resolve = {
  pool: ['pool', 'pool', 'administrate']
}

// -------------------------------------------------------------------

async function handlePatchUpload (req, res, {pool}) {
  const {headers: {['content-length']: contentLength}} = req
  if (!contentLength) {
    res.writeHead(411)
    res.end('Content length is mandatory')
    return
  }

  await this.getXAPI(pool).uploadPoolPatch(req, contentLength)
}

export async function uploadPatch ({pool}) {
  return {
    $sendTo: await this.registerHttpRequest(handlePatchUpload, {pool})
  }
}

uploadPatch.params = {
  pool: { type: 'string' }
}

uploadPatch.resolve = {
  pool: ['pool', 'pool', 'administrate']
}

// Compatibility
//
// TODO: remove when no longer used in xo-web
export {uploadPatch as patch}

// -------------------------------------------------------------------

async function mergeInto ({ source, target, force }) {
  await this.mergeXenPools(source.id, target.id, force)
}

mergeInto.params = {
  force: { type: 'boolean', optional: true },
  source: { type: 'string' },
  target: { type: 'string' }
}

mergeInto.resolve = {
  source: ['source', 'pool', 'administrate'],
  target: ['target', 'pool', 'administrate']
}
