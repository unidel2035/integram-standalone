/**
 * Taskade Service - API client for Taskade functionality
 *
 * Handles boards, columns, cards, comments, attachments, labels, and activity log
 */

import axios from 'axios'

const API_BASE = '/api/organizations'

class TaskadeService {
  /**
   * Boards API
   */
  async getBoards(orgId) {
    const response = await axios.get(`${API_BASE}/${orgId}/boards`)
    return response.data
  }

  async createBoard(orgId, boardData) {
    const response = await axios.post(`${API_BASE}/${orgId}/boards`, boardData)
    return response.data
  }

  async updateBoard(orgId, boardId, boardData) {
    const response = await axios.put(`${API_BASE}/${orgId}/boards/${boardId}`, boardData)
    return response.data
  }

  async deleteBoard(orgId, boardId) {
    const response = await axios.delete(`${API_BASE}/${orgId}/boards/${boardId}`)
    return response.data
  }

  /**
   * Columns API
   */
  async getColumns(orgId, boardId) {
    const response = await axios.get(`${API_BASE}/${orgId}/boards/${boardId}/columns`)
    return response.data
  }

  async createColumn(orgId, boardId, columnData) {
    const response = await axios.post(`${API_BASE}/${orgId}/boards/${boardId}/columns`, columnData)
    return response.data
  }

  async updateColumn(orgId, boardId, columnId, columnData) {
    const response = await axios.put(`${API_BASE}/${orgId}/boards/${boardId}/columns/${columnId}`, columnData)
    return response.data
  }

  async deleteColumn(orgId, boardId, columnId) {
    const response = await axios.delete(`${API_BASE}/${orgId}/boards/${boardId}/columns/${columnId}`)
    return response.data
  }

  /**
   * Cards API
   */
  async getCards(orgId, boardId, columnId = null) {
    const url = columnId
      ? `${API_BASE}/${orgId}/boards/${boardId}/cards?columnId=${columnId}`
      : `${API_BASE}/${orgId}/boards/${boardId}/cards`
    const response = await axios.get(url)
    return response.data
  }

  async createCard(orgId, boardId, columnId, cardData) {
    const response = await axios.post(
      `${API_BASE}/${orgId}/boards/${boardId}/columns/${columnId}/cards`,
      cardData
    )
    return response.data
  }

  async updateCard(orgId, boardId, cardId, cardData) {
    const response = await axios.put(`${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}`, cardData)
    return response.data
  }

  async moveCard(orgId, boardId, cardId, newColumnId) {
    const response = await axios.post(
      `${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/move`,
      { newColumnId }
    )
    return response.data
  }

  async deleteCard(orgId, boardId, cardId) {
    const response = await axios.delete(`${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}`)
    return response.data
  }

  /**
   * Comments API
   */
  async getComments(orgId, boardId, cardId) {
    const response = await axios.get(`${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/comments`)
    return response.data
  }

  async createComment(orgId, boardId, cardId, text) {
    const response = await axios.post(
      `${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/comments`,
      { text }
    )
    return response.data
  }

  async deleteComment(orgId, boardId, cardId, commentId) {
    const response = await axios.delete(
      `${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/comments/${commentId}`
    )
    return response.data
  }

  /**
   * Attachments API
   */
  async getAttachments(orgId, boardId, cardId) {
    const response = await axios.get(`${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/attachments`)
    return response.data
  }

  async createAttachment(orgId, boardId, cardId, attachmentData) {
    const response = await axios.post(
      `${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/attachments`,
      attachmentData
    )
    return response.data
  }

  async deleteAttachment(orgId, boardId, cardId, attachmentId) {
    const response = await axios.delete(
      `${API_BASE}/${orgId}/boards/${boardId}/cards/${cardId}/attachments/${attachmentId}`
    )
    return response.data
  }

  /**
   * Labels API
   */
  async getLabels(orgId) {
    const response = await axios.get(`${API_BASE}/${orgId}/labels`)
    return response.data
  }

  async createLabel(orgId, labelData) {
    const response = await axios.post(`${API_BASE}/${orgId}/labels`, labelData)
    return response.data
  }

  async updateLabel(orgId, labelId, labelData) {
    const response = await axios.put(`${API_BASE}/${orgId}/labels/${labelId}`, labelData)
    return response.data
  }

  async deleteLabel(orgId, labelId) {
    const response = await axios.delete(`${API_BASE}/${orgId}/labels/${labelId}`)
    return response.data
  }

  /**
   * Activity Log API
   */
  async getActivity(orgId, limit = 50, offset = 0) {
    const response = await axios.get(`${API_BASE}/${orgId}/activity`, {
      params: { limit, offset }
    })
    return response.data
  }
}

export default new TaskadeService()
