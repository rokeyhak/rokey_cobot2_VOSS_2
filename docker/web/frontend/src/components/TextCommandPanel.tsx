import { useEffect, useState } from 'react';
import { RequestFailure, submitTextCommand } from '../api';

export interface TextReply { request_id: string; message: string }
interface Entry { id: string; text: string; reply: string }

export function TextCommandPanel({connected, enabled, reply}: {
  connected: boolean; enabled: boolean; reply: TextReply | null;
}) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!reply) return;
    setEntries(current => current.map(entry => entry.id === reply.request_id
      ? {...entry, reply: reply.message} : entry));
  }, [reply]);

  async function send() {
    const message = text.trim();
    if (!message || !enabled || !connected || sending) return;
    const id = crypto.randomUUID();
    setEntries(current => [...current.slice(-19), {id, text: message, reply: '명령 해석 중…'}]);
    setText('');
    setSending(true);
    try {
      await submitTextCommand(message, id);
    } catch (error) {
      const detail = error instanceof RequestFailure ? `${error.code} · ${error.message}` : '전달에 실패했습니다.';
      setEntries(current => current.map(entry => entry.id === id ? {...entry, reply: detail} : entry));
    } finally {
      setSending(false);
    }
  }

  return <section className="panel text-command-panel">
    <div className="section-heading"><div><span className="eyebrow">TEXT / INTENT</span><h2>텍스트 명령</h2></div><span className="micro-note">Web PC 로컬 입력</span></div>
    <div className="text-command-history" role="log" aria-live="polite">
      {entries.length === 0 && <p className="empty">예: 역삼, 대치 순서로 팔레타이징 실행해</p>}
      {entries.map(entry => <div className="text-command-turn" key={entry.id}>
        <p className="text-command-user">{entry.text}</p>
        <p className="text-command-reply">{entry.reply}</p>
      </div>)}
    </div>
    <form className="text-command-form" onSubmit={event => {event.preventDefault(); void send();}}>
      <input aria-label="로봇 명령 입력" value={text} maxLength={240}
        onChange={event => setText(event.target.value)} placeholder="명령을 입력하세요"
        disabled={!enabled || !connected || sending}/>
      <button type="submit" disabled={!enabled || !connected || sending || !text.trim()}>전송</button>
    </form>
    {!enabled && <p className="micro-note">명령 입력은 Web PC 로컬에서만 가능합니다.</p>}
  </section>;
}
