import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTING_TENANT_KEY = 'jawabify_acting_tenant';
const SUPER_ADMIN_CACHE_KEY = 'jawabify_is_super_admin';

let actingMemory: { id: string; name: string } | null = null;

export function getActingMemory() {
  return actingMemory;
}

export function setActingMemory(value: { id: string; name: string } | null) {
  actingMemory = value;
}

export async function loadActing(): Promise<{ id: string; name: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTING_TENANT_KEY);
    if (!raw) {
      actingMemory = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    actingMemory = parsed?.id ? { id: parsed.id, name: parsed.name ?? 'Account' } : null;
    return actingMemory;
  } catch {
    return null;
  }
}

export async function persistActing(value: { id: string; name: string } | null) {
  actingMemory = value;
  try {
    if (value) await AsyncStorage.setItem(ACTING_TENANT_KEY, JSON.stringify(value));
    else await AsyncStorage.removeItem(ACTING_TENANT_KEY);
  } catch {
    /* ignore */
  }
}

export function actingHeaders(): Record<string, string> {
  return actingMemory?.id ? { 'x-acting-tenant': actingMemory.id } : {};
}

export async function readCachedSuperAdmin(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SUPER_ADMIN_CACHE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function writeCachedSuperAdmin(value: boolean) {
  try {
    if (value) await AsyncStorage.setItem(SUPER_ADMIN_CACHE_KEY, 'true');
    else await AsyncStorage.removeItem(SUPER_ADMIN_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
