import { http } from '@/api/http';
import type { AdminAuthResponse, ClubInvitationDto, JobDto, JobsOverviewDto, LicensesOverviewDto } from '@/types/api';

/** Administración (/jobs): cada llamada lleva el token del administrador, aparte de la sesión normal. */
export const adminApi = {
  login: (userName: string, password: string) =>
    http<AdminAuthResponse>('/api/admin/login', { method: 'POST', body: { userName, password } }),
  jobs: (token: string, provider: string | null, silent = false) =>
    http<JobsOverviewDto>(`/api/admin/jobs?requests=200${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`, { token, silent }),
  run: (token: string, job: string) => http<JobDto>(`/api/admin/jobs/${encodeURIComponent(job)}/run`, { method: 'POST', token }),
  licenses: (token: string) => http<LicensesOverviewDto>('/api/admin/licenses', { token }),
  invitations: (token: string) => http<ClubInvitationDto[]>('/api/admin/club-invitations', { token, silent: true }),
  createInvitation: (token: string, note: string | null, expiresInDays: number | null) =>
    http<ClubInvitationDto>('/api/admin/club-invitations', { method: 'POST', token, body: { note, expiresInDays } }),
  revokeInvitation: (token: string, id: string) => http<ClubInvitationDto>(`/api/admin/club-invitations/${id}/revoke`, { method: 'POST', token }),
};
