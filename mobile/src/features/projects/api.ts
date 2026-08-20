import { apiRequest } from '@/lib/api';

import type { Project } from './types';

function jsonRequest(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function getProjectsRequest() {
  return apiRequest<Project[]>('/projects');
}

export function createProjectRequest(values: {
  name: string;
  description?: string;
}) {
  return apiRequest<Project>('/projects', jsonRequest('POST', values));
}

export function updateProjectRequest(
  projectId: number,
  values: Partial<Pick<Project, 'name' | 'description' | 'pinned'>>,
) {
  return apiRequest<Project>(
    `/projects/${projectId}`,
    jsonRequest('PATCH', values),
  );
}

export function deleteProjectRequest(projectId: number) {
  return apiRequest<{ message: string; id: number }>(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}
