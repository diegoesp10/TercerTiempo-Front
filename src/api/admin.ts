import { http } from '@/api/http';
import type {
  AdminAuthResponse,
  AnalyticsReportDto,
  ClubScope,
  CommentCheckDto,
  CommentFilter,
  ForbiddenWordKind,
  ForbiddenWordsDto,
  RefereeCommentAdminDto,
  RefereeCommentsDto,
  CookiePolicyDto,
  UpsertCookieRequest,
  ClubInvitationDto,
  FootballSyncSettingsDto,
  InvitationClubDto,
  JobDto,
  JobsOverviewDto,
  LicensesOverviewDto,
  LiveDownloadsDto,
  PaymentEventDto,
  SimulatedLicenseEvent,
  LicensingSettingsDto,
  RunFootballSyncRequest,
  UpdateFootballSyncRequest,
  UpdateLicensingSettingsRequest,
} from '@/types/api';

/** Administración (/jobs): cada llamada lleva el token del administrador, aparte de la sesión normal. */
export const adminApi = {
  login: (userName: string, password: string) =>
    http<AdminAuthResponse>('/api/admin/login', { method: 'POST', body: { userName, password } }),
  jobs: (token: string, provider: string | null, silent = false) =>
    http<JobsOverviewDto>(`/api/admin/jobs?requests=200${provider ? `&provider=${encodeURIComponent(provider)}` : ''}`, { token, silent }),
  run: (token: string, job: string) => http<JobDto>(`/api/admin/jobs/${encodeURIComponent(job)}/run`, { method: 'POST', token }),
  footballSync: (token: string) => http<FootballSyncSettingsDto>('/api/admin/football-sync', { token, silent: true }),
  updateFootballSync: (token: string, body: UpdateFootballSyncRequest) =>
    http<FootballSyncSettingsDto>('/api/admin/football-sync', { method: 'PUT', token, body }),
  runFootballSync: (token: string, body: RunFootballSyncRequest) =>
    http<JobDto>('/api/admin/football-sync/run', { method: 'POST', token, body }),
  liveDownloads: (token: string) => http<LiveDownloadsDto>('/api/admin/live-downloads', { token, silent: true }),
  cancelSheetDownloads: (token: string, onlyFinished: boolean) =>
    http<number>(`/api/admin/sheet-downloads/cancel?onlyFinished=${onlyFinished}`, { method: 'POST', token }),
  analytics: (token: string, from: string, to: string, clubId: string | null, scope: ClubScope) =>
    http<AnalyticsReportDto>(
      `/api/admin/analytics?from=${from}&to=${to}&scope=${scope}${clubId ? `&clubId=${clubId}` : ''}`,
      { token, silent: true },
    ),
  createCookie: (token: string, body: UpsertCookieRequest) => http<CookiePolicyDto>('/api/admin/cookies', { method: 'POST', token, body }),
  updateCookie: (token: string, id: string, body: UpsertCookieRequest) =>
    http<CookiePolicyDto>(`/api/admin/cookies/${id}`, { method: 'PUT', token, body }),
  deleteCookie: (token: string, id: string) => http<CookiePolicyDto>(`/api/admin/cookies/${id}`, { method: 'DELETE', token }),
  publishCookiePolicy: (token: string, version: string) =>
    http<CookiePolicyDto>('/api/admin/cookies/policy', { method: 'POST', token, body: { version } }),
  licenses: (token: string) => http<LicensesOverviewDto>('/api/admin/licenses', { token }),
  paymentEvents: (token: string, licenseId: string | null = null) =>
    http<PaymentEventDto[]>(`/api/admin/payment-events?max=100${licenseId ? `&licenseId=${licenseId}` : ''}`, { token, silent: true }),
  retryPaymentEvent: (token: string, id: string) => http<boolean>(`/api/admin/payment-events/${id}/retry`, { method: 'POST', token }),
  simulateLicenseEvent: (token: string, licenseId: string, event: SimulatedLicenseEvent) =>
    http<{ summary: string }>(`/api/admin/licenses/${licenseId}/simulate`, { method: 'POST', token, body: { event } }),
  licensingSettings: (token: string) => http<LicensingSettingsDto>('/api/admin/licensing-settings', { token }),
  updateLicensingSettings: (token: string, body: UpdateLicensingSettingsRequest) =>
    http<LicensingSettingsDto>('/api/admin/licensing-settings', { method: 'PUT', token, body }),
  invitations: (token: string) => http<ClubInvitationDto[]>('/api/admin/club-invitations', { token, silent: true }),
  invitationClubs: (token: string, q: string) =>
    http<InvitationClubDto[]>(`/api/admin/club-invitations/clubs?q=${encodeURIComponent(q)}`, { token, silent: true }),
  createInvitation: (token: string, note: string | null, expiresInDays: number | null, teamId: string) =>
    http<ClubInvitationDto>('/api/admin/club-invitations', { method: 'POST', token, body: { note, expiresInDays, teamId } }),
  revokeInvitation: (token: string, id: string) => http<ClubInvitationDto>(`/api/admin/club-invitations/${id}/revoke`, { method: 'POST', token }),
  refereeComments: (token: string, filter: CommentFilter, search: string) =>
    http<RefereeCommentsDto>(`/api/admin/moderation/referee-comments?filter=${filter}${search ? `&search=${encodeURIComponent(search)}` : ''}`, { token }),
  setCommentHidden: (token: string, ratingId: string, hidden: boolean) =>
    http<RefereeCommentAdminDto>(`/api/admin/moderation/referee-comments/${ratingId}/hidden`, { method: 'PUT', token, body: { hidden } }),
  forbiddenWords: (token: string) => http<ForbiddenWordsDto>('/api/admin/moderation/forbidden-words', { token }),
  addForbiddenWord: (token: string, term: string, kind: ForbiddenWordKind) =>
    http<ForbiddenWordsDto>('/api/admin/moderation/forbidden-words', { method: 'POST', token, body: { term, kind } }),
  removeForbiddenWord: (token: string, term: string) =>
    http<ForbiddenWordsDto>(`/api/admin/moderation/forbidden-words/${encodeURIComponent(term)}`, { method: 'DELETE', token }),
  checkText: (token: string, text: string) => http<CommentCheckDto>('/api/admin/moderation/check', { method: 'POST', token, body: { text } }),
};
