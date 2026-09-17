export interface MobileStatus {
  pending: number; through: string | null; permission: string; exact: boolean;
  error: string | null; platform: string;
}
let status: MobileStatus = { pending: 0, through: null, permission: 'prompt', exact: true, error: null, platform: '' };
const listeners = new Set<() => void>();
export const mobileStatus = () => status;
export function setMobileStatus(patch: Partial<MobileStatus>) { status = { ...status, ...patch }; for (const callback of listeners) callback(); }
export function subscribeMobileStatus(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }
export let refreshMobileNotifications = async () => {};
export let requestExactAlarms = async () => {};
export function mobileActions(refresh: () => Promise<void>, exact: () => Promise<void>) { refreshMobileNotifications = refresh; requestExactAlarms = exact; }
