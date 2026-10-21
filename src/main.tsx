import { createRoot } from 'react-dom/client';
import { Component } from 'react';
import type { ReactNode } from 'react';
import '@excalidraw/excalidraw/index.css';
import './styles.css';
import App from './App';
// Resolve relative to this deployment, including static hosts under a subdirectory.
window.EXCALIDRAW_ASSET_PATH = new URL(
  `${import.meta.env.BASE_URL}excalidraw/`,
  window.location.href,
).href;
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div style={{ padding: 40, fontFamily: 'system-ui', lineHeight: 1.7 }}>
        <h1>Let’s reopen your workspace.</h1>
        <p>
          The editor encountered an unexpected problem. Saved boards and
          recovery drafts remain in this browser.
        </p>
        <button onClick={() => location.reload()}>Reload FreeBoard</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
await Promise.all([
  document.fonts.load('20px Helvetica', 'FreeBoard'),
  document.fonts.load('20px "FreeBoard Bengali"', 'বাংলা'),
]).catch(() => {});
createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>,
);
