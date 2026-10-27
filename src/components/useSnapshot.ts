import { useCallback, useEffect, useState } from 'react';
import { initialSnapshot } from '../domain/contracts';
import { getSnapshot, isExtensionContext } from '../messaging/client';
import { SNAPSHOT_KEY } from '../background/foundation';

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState(initialSnapshot(__FOUNDATION_MOCK__ ? 'mock' : 'capture'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setSnapshot(await getSnapshot()); setError(null); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Não foi possível ler o estado.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void getSnapshot().then((value) => { if (active) { setSnapshot(value); setError(null); } })
      .catch(() => { if (active) setError('Não foi possível ler o estado da extensão. Tente atualizar.'); })
      .finally(() => { if (active) setLoading(false); });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[SNAPSHOT_KEY]) void refresh();
    };
    if (isExtensionContext()) chrome.storage.onChanged.addListener(onChange);
    return () => { active = false; if (isExtensionContext()) chrome.storage.onChanged.removeListener(onChange); };
  }, [refresh]);
  return { snapshot, setSnapshot, loading, error, setError, refresh };
}
