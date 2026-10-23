import { http } from '@/api/http';
import type { AdminAuthResponse, JobDto, JobsOverviewDto } from '@/types/api';

/** Administración (/jobs): cada llamada lleva el token del administrador, aparte de la sesión normal. */
export const adminApi = {
  login: (userName: string, password: string) =>
    http<AdminAuthResponse>('/api/admin/login', { method: 'POST', body: { userName, password } }),
  jobs: (token: string, provider: string | null, silent = false) =>
    http<JobsOverviewDto>(`/api/admin/jobs?requests=200${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`, { token, silent }),
  run: (token: string, job: string) => http<JobDto>(`/api/admin/jobs/${encodeURIComponent(job)}/run`, { method: 'POST', token }),
};
