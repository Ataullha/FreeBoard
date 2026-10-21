import { createRoot } from 'react-dom/client';
import { Component, Suspense, lazy, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  Github,
  LockKeyhole,
  MousePointer2,
  Pencil,
  Play,
  WifiOff,
} from 'lucide-react';
import './showcase.css';
import type { TemplateId } from '../editor/templates';

const Demo = lazy(() => import('./InteractiveDemo'));
const starters = [
  {
    id: 'lesson',
    label: 'Teach a lesson',
    hint: 'Explain it your way. Write in Bengali, English, or both.',
    image: 'lesson.jpg',
  },
  {
    id: 'brainstorm',
    label: 'Find an idea',
    hint: 'Give each thought a little space. Move the notes around.',
    image: 'brainstorm.jpg',
  },
  {
    id: 'flowchart',
    label: 'Connect the steps',
    hint: 'Make a process clear. Move a step and its arrows follow.',
    image: 'flowchart.jpg',
  },
] as const;

class DemoBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="demo-loading" role="alert">
        <strong>The preview could not open.</strong>
        <p>Please reload, or open the full whiteboard.</p>
        <a className="button primary" href="./">
          Open FreeBoard <ArrowUpRight size={16} />
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Showcase() {
  const [template, setTemplate] =
    useState<Exclude<TemplateId, 'blank'>>('lesson');
  const [interactive, setInteractive] = useState(false);
  const starter = starters.find((s) => s.id === template)!;
  return (
    <>
      <a className="skip-link" href="#try">
        Skip to interactive preview
      </a>
      <header className="site-header wrap">
        <a className="wordmark" href="./" aria-label="Open FreeBoard">
          <img src="./icons/freeboard.svg" width="34" height="34" alt="" />
          FreeBoard<span className="tag">OPEN SOURCE</span>
        </a>
        <nav aria-label="Product navigation">
          <a
            className="source-link"
            href="https://github.com/Ataullha/FreeBoard"
          >
            <Github size={17} />
            Source
          </a>
          <a className="button small primary" href="./">
            Open whiteboard <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> A QUIET PLACE TO THINK
            </p>
            <h1 id="hero-title">
              Make space
              <br />
              for{' '}
              <span className="idea-word">
                ideas.
                <svg viewBox="0 0 220 15" aria-hidden="true">
                  <path d="M4 9C54 0 144 2 215 8M21 13C89 7 165 8 197 10" />
                </svg>
              </span>
            </h1>
            <p className="lead">
              A lesson to explain.
              <br />A thought to untangle.
              <br />A whole canvas to make it clear.
            </p>
            <a className="button primary hero-cta" href="./">
              Start your board <ArrowUpRight size={19} />
            </a>
            <p className="no-setup">
              <Check size={14} /> Free to use. No account needed.
            </p>
            <div className="hero-aside">
              <span className="tiny-label">MADE FOR EVERYDAY THINKING</span>
              <p>
                For the classroom, your next project,
                <br />
                and the idea you haven’t named yet.
              </p>
              <a href="#try">
                Take it for a spin <ArrowDown size={14} />
              </a>
            </div>
          </div>
          <div className="product-area" id="try">
            <div className="preview-label">
              <span>
                <span className="status-dot" />
                {interactive
                  ? 'YOU’RE IN. MAKE A MARK.'
                  : 'A REAL CANVAS. YOUR NEXT IDEA.'}
              </span>
              <span className="preview-index">01 — 03</span>
            </div>
            <div
              className="starter-tabs"
              role="group"
              aria-label="Preview templates"
            >
              {starters.map((s, i) => (
                <button
                  key={s.id}
                  aria-pressed={template === s.id}
                  onClick={() => setTemplate(s.id)}
                >
                  <span className="tab-number">0{i + 1}</span>
                  {s.label}
                  <ChevronRight size={13} />
                </button>
              ))}
            </div>
            <div
              className={`product-window ${interactive ? 'is-interactive' : ''}`}
            >
              <div className="window-bar">
                <span>
                  <img
                    src="./icons/freeboard.svg"
                    alt=""
                    width="18"
                    height="18"
                  />
                  {starter.label}
                </span>
                <span>
                  {interactive
                    ? 'Temporary preview'
                    : 'FreeBoard · in your browser'}
                </span>
              </div>
              {interactive ? (
                <DemoBoundary>
                  <Suspense
                    fallback={
                      <div className="demo-loading" role="status">
                        <span className="loading-ring" />
                        Opening the drawing tools…
                      </div>
                    }
                  >
                    <Demo template={template} />
                  </Suspense>
                </DemoBoundary>
              ) : (
                <div className="poster">
                  <img
                    src={`./showcase/${starter.image}`}
                    alt={`The real FreeBoard workspace: ${starter.label.toLowerCase()}, with editable objects and drawing controls.`}
                    width="1363"
                    height="936"
                    fetchPriority="high"
                  />
                  <div className="poster-cta">
                    <button
                      className="button primary"
                      onClick={() => setInteractive(true)}
                    >
                      <Play size={16} fill="currentColor" />
                      Try drawing here
                    </button>
                    <span>Draw, edit, and move things around.</span>
                  </div>
                </div>
              )}
            </div>
            <p className="preview-caption">
              <MousePointer2 size={15} />
              <span>{starter.hint}</span>
            </p>
          </div>
        </section>
        <section
          className="principles wrap"
          aria-label="What makes FreeBoard useful"
        >
          <article>
            <span className="principle-number">01 / NATURAL TO USE</span>
            <h2>
              <Pencil size={21} />A pen. A plan. A possibility.
            </h2>
            <p>
              Pressure-aware ink, a finer width slider, shapes, connected
              arrows, notes, and images. Write in Bengali and English.
            </p>
          </article>
          <article>
            <span className="principle-number">02 / YOUR WORK STAYS YOURS</span>
            <h2>
              <LockKeyhole size={21} />
              Saved close to home.
            </h2>
            <p>
              The full app saves on your device. Download editable backups, or
              share a PNG or SVG. Browser storage can be cleared, so keep a
              backup.
            </p>
          </article>
          <article>
            <span className="principle-number">
              03 / LESS TO GET IN THE WAY
            </span>
            <h2>
              <WifiOff size={21} />
              Keep your train of thought.
            </h2>
            <p>
              Install the app, then use it offline after caching. A small clock,
              undoable clearing, and simple controls keep useful things close.
            </p>
          </article>
        </section>
        <section className="closing wrap">
          <div>
            <p className="eyebrow">YOURS TO USE. OURS TO IMPROVE.</p>
            <h2>A good idea deserves a little room.</h2>
            <p>
              FreeBoard is open source, with an MIT license. Feedback and
              contributions are welcome.
            </p>
          </div>
          <a className="button primary" href="./">
            Make your first mark <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer className="site-footer wrap">
        <a className="wordmark" href="./">
          <img src="./icons/freeboard.svg" width="22" height="22" alt="" />
          FreeBoard
        </a>
        <span>Built with React, TypeScript &amp; Excalidraw.</span>
        <a href="https://github.com/Ataullha/FreeBoard">
          View the source <ArrowUpRight size={13} />
        </a>
      </footer>
    </>
  );
}

createRoot(document.getElementById('showcase-root')!).render(<Showcase />);
