import { memo, useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
const format = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
/** Its own minute-aligned state keeps clock ticks out of the editor's input path. */
export const LocalClock = memo(function LocalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      setNow(new Date());
      if (!document.hidden)
        timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 10);
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return (
    <time
      className="local-clock"
      dateTime={now.toISOString()}
      aria-label="Local time"
      title={now.toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })}
    >
      <Clock3 size={14} aria-hidden="true" />
      <span>{format.format(now)}</span>
    </time>
  );
});
