import { apiRequest } from '@/lib/api';

import type { Task } from './types';

function jsonRequest(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function getTasksRequest(projectId: number) {
  return apiRequest<Task[]>(`/projects/${projectId}/tasks`);
}

export function createTaskRequest(projectId: number, title: string) {
  return apiRequest<Task>(
    `/projects/${projectId}/tasks`,
    jsonRequest('POST', { title }),
  );
}

export function updateTaskRequest(
  projectId: number,
  taskId: number,
  values: Partial<Pick<Task, 'title' | 'completed'>>,
) {
  return apiRequest<Task>(
    `/projects/${projectId}/tasks/${taskId}`,
    jsonRequest('PATCH', values),
  );
}

export function reorderTasksRequest(projectId: number, taskIds: number[]) {
  return apiRequest<Task[]>(
    `/projects/${projectId}/tasks/reorder`,
    jsonRequest('PATCH', { taskIds }),
  );
}

export function deleteTaskRequest(projectId: number, taskId: number) {
  return apiRequest<{ message: string }>(
    `/projects/${projectId}/tasks/${taskId}`,
    { method: 'DELETE' },
  );
}
