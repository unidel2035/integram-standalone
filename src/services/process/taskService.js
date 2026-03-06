import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Task Service for managing user tasks in process workflows
 */
export function useTaskService() {
  /**
   * Get all tasks assigned to the current user
   * @returns {Promise<Array>} List of tasks
   */
  async function getMyTasks() {
    try {
      const response = await axios.get(`${API_BASE_URL}/process/tasks/my-tasks`)
      return response.data.tasks || []
    } catch (error) {
      console.error('Error fetching tasks:', error)
      // Return mock data for development
      return getMockTasks()
    }
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task details
   */
  async function getTaskById(taskId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/process/tasks/${taskId}`)
      return response.data.task
    } catch (error) {
      console.error('Error fetching task:', error)
      throw error
    }
  }

  /**
   * Complete a user task
   * @param {string} taskId - Task ID
   * @param {Object} formData - Form data submitted by user
   * @returns {Promise<Object>} Completion result
   */
  async function completeTask(taskId, formData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/process/tasks/${taskId}/complete`, {
        formData
      })
      return response.data
    } catch (error) {
      console.error('Error completing task:', error)
      throw error
    }
  }

  /**
   * Assign task to a user
   * @param {string} taskId - Task ID
   * @param {string} userId - User ID to assign to
   * @returns {Promise<Object>} Assignment result
   */
  async function assignTask(taskId, userId) {
    try {
      const response = await axios.post(`${API_BASE_URL}/process/tasks/${taskId}/assign`, {
        userId
      })
      return response.data
    } catch (error) {
      console.error('Error assigning task:', error)
      throw error
    }
  }

  /**
   * Get tasks for a specific process instance
   * @param {string} processInstanceId - Process instance ID
   * @returns {Promise<Array>} List of tasks
   */
  async function getTasksByProcessInstance(processInstanceId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/process/tasks/by-process/${processInstanceId}`
      )
      return response.data.tasks || []
    } catch (error) {
      console.error('Error fetching tasks by process:', error)
      return []
    }
  }

  /**
   * Create a new user task
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async function createUserTask(taskData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/process/tasks/create`, taskData)
      return response.data.task
    } catch (error) {
      console.error('Error creating task:', error)
      throw error
    }
  }

  /**
   * Mock tasks for development
   * @returns {Array} Mock tasks
   */
  function getMockTasks() {
    return [
      {
        id: 'task-1',
        name: 'Review Document',
        processName: 'Document Approval Process',
        processInstanceId: 'proc-123',
        priority: 'high',
        status: 'active',
        createdAt: new Date().toISOString(),
        assignee: 'current-user',
        formSchema: {
          fields: [
            {
              id: 'document_id',
              type: 'text',
              label: 'Document ID',
              readonly: true,
              defaultValue: 'DOC-2024-001'
            },
            {
              id: 'approval_decision',
              type: 'select',
              label: 'Decision',
              required: true,
              options: [
                { value: 'approve', label: 'Approve' },
                { value: 'reject', label: 'Reject' },
                { value: 'request_changes', label: 'Request Changes' }
              ]
            },
            {
              id: 'comments',
              type: 'textarea',
              label: 'Comments',
              required: false,
              conditional: {
                field: 'approval_decision',
                value: 'reject'
              }
            }
          ],
          validations: [
            {
              field: 'comments',
              rule: 'minLength',
              value: 10,
              message: 'Comments must be at least 10 characters'
            }
          ]
        }
      },
      {
        id: 'task-2',
        name: 'Approve Budget',
        processName: 'Budget Review Process',
        processInstanceId: 'proc-456',
        priority: 'medium',
        status: 'active',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        assignee: 'current-user',
        formSchema: {
          fields: [
            {
              id: 'budget_amount',
              type: 'number',
              label: 'Budget Amount',
              readonly: true,
              defaultValue: 50000
            },
            {
              id: 'decision',
              type: 'select',
              label: 'Decision',
              required: true,
              options: [
                { value: 'approve', label: 'Approve' },
                { value: 'reject', label: 'Reject' }
              ]
            }
          ]
        }
      },
      {
        id: 'task-3',
        name: 'Verify Information',
        processName: 'Data Verification',
        processInstanceId: 'proc-789',
        priority: 'low',
        status: 'pending',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        assignee: 'current-user',
        formSchema: {
          fields: [
            {
              id: 'verified',
              type: 'select',
              label: 'Verification Status',
              required: true,
              options: [
                { value: 'verified', label: 'Verified' },
                { value: 'needs_review', label: 'Needs Review' }
              ]
            }
          ]
        }
      }
    ]
  }

  return {
    getMyTasks,
    getTaskById,
    completeTask,
    assignTask,
    getTasksByProcessInstance,
    createUserTask
  }
}
