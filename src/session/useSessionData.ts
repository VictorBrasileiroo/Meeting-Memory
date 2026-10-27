import { onMeetingChange } from '../storage/meeting-events';
import { useEffect, useState } from 'react';
import { getNotes, getRecording, listJobs, listTranscripts } from '../storage/recordings';
import { listPartReferences, type SessionData } from './session-data';

export function useSessionData(recordingId: string) {
  const [data, setData] = useState<SessionData>();
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [recording, notes, jobs, transcripts, parts] = await Promise.all([getRecording(recordingId), getNotes(recordingId), listJobs(recordingId), listTranscripts(recordingId), listPartReferences(recordingId)]);
        if (active) { setData({ recording, notes, jobs, transcripts, parts }); setProblem(''); }
      } catch { if (active) setProblem('Não foi possível ler esta reunião. Tente atualizar a página.'); }
      finally { inFlight = false; }
    };
    void refresh();
    const stopChanges = onMeetingChange(change => { if (change.recordingId === recordingId) void refresh(); });
    const timer = setInterval(() => void refresh(), 3000);
    return () => { active = false; clearInterval(timer); stopChanges(); };
  }, [recordingId]);
  return { data, problem };
}
