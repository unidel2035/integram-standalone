const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

function getAuthHeaders() {
  // TODO: Add authentication if needed
  return {}
}

export async function listStorages() {
  const response = await fetch(`${API_BASE_URL}/pentaract/storages`, {
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to list storages')
  }

  const result = await response.json()
  return result.data
}

export async function getStorage(storageId) {
  const response = await fetch(`${API_BASE_URL}/pentaract/storages/${storageId}`, {
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get storage')
  }

  const result = await response.json()
  return result.data
}

export async function createStorage(name, chatId) {
  const response = await fetch(`${API_BASE_URL}/pentaract/storages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ name, chat_id: chatId })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create storage')
  }

  const result = await response.json()
  return result.data
}

export async function deleteStorage(storageId) {
  const response = await fetch(`${API_BASE_URL}/pentaract/storages/${storageId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete storage')
  }

  return true
}

export async function getTree(storageId, path = '') {
  const response = await fetch(`${API_BASE_URL}/pentaract/storages/${storageId}/tree/${path}`, {
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get tree')
  }

  const result = await response.json()
  return result.data
}

export async function scanChannel(storageId, options = {}) {
  const params = new URLSearchParams()
  if (options.dryRun !== undefined) params.append('dryRun', options.dryRun)
  if (options.limit) params.append('limit', options.limit)

  const response = await fetch(
    `${API_BASE_URL}/pentaract/storages/${storageId}/scan?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to scan channel')
  }

  const result = await response.json()
  return result.data
}

export async function uploadFile(storageId, file, remotePath) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', remotePath)

  const response = await fetch(`${API_BASE_URL}/pentaract/storages/${storageId}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload file')
  }

  const result = await response.json()
  return result.data
}

export async function downloadFile(storageId, remotePath) {
  const response = await fetch(
    `${API_BASE_URL}/pentaract/storages/${storageId}/download/${remotePath}`,
    {
      headers: getAuthHeaders()
    }
  )

  if (!response.ok) {
    throw new Error('Failed to download file')
  }

  return response.blob()
}
