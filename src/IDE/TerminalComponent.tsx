import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export interface TerminalHandle {
  write: (text: string) => void;
  clear: () => void;
}

export const TerminalComponent = forwardRef<TerminalHandle>((_, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xterm = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    write: (text: string) => xterm.current?.write(text),
    clear: () => xterm.current?.reset()
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    xterm.current = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' },
      fontSize: 12,
      fontFamily: 'monospace',
      convertEol: true
    });

    fitAddon.current = new FitAddon();
    xterm.current.loadAddon(fitAddon.current);
    xterm.current.open(terminalRef.current);

    setTimeout(() => {
      fitAddon.current?.fit();
    }, 0);

    xterm.current.writeln('\x1b[1;32m⚡ Terminal Ready\x1b[0m');

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.current?.fit();
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      xterm.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{ height: '100%', width: '100%', backgroundColor: '#1e1e1e', padding: 1, overflow: 'hidden' }}
    />
  );
});
