const PREFERENCE = 'moveide.quick-tour.dismissed.v1';
const STYLE = `
.moveide-tour-root{font:14px/1.5 system-ui,sans-serif;color:#173e3c;position:fixed;right:18px;bottom:18px;z-index:80;pointer-events:none}
.moveide-tour-invitation,.moveide-tour-root button{pointer-events:auto}.moveide-tour-root button,.moveide-tour-dialog button{font:inherit;min-height:44px;min-width:44px;border:1px solid #b8cfca;border-radius:10px;background:#fff;color:#173e3c;padding:9px 14px;cursor:pointer;letter-spacing:normal;text-transform:none}
.moveide-tour-root button:focus-visible,.moveide-tour-dialog button:focus-visible{outline:3px solid #147d70;outline-offset:3px}
.moveide-tour-root .moveide-tour-open{box-shadow:0 3px 18px #153e3c20}
.moveide-tour-invitation{position:absolute;right:0;bottom:54px;width:min(300px,calc(100vw - 36px));padding:16px;border:1px solid #b8cfca;border-radius:16px;background:#fff;box-shadow:0 8px 28px #153e3c20;box-sizing:border-box}
.moveide-tour-invitation p{margin:0 0 12px}.moveide-tour-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.moveide-tour-dialog{font:16px/1.55 system-ui,sans-serif;color:#173e3c;background:#fff;border:1px solid #b8cfca;border-radius:20px;padding:24px;width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;box-shadow:0 20px 80px #102e3c30}
.moveide-tour-dialog::backdrop{background:#f3f0e84d}.moveide-tour-target{outline:3px solid #176e61!important;outline-offset:6px!important;box-shadow:0 0 0 10px #d9e9da!important;border-radius:8px}.moveide-tour-pointer{font:600 13px/1.4 system-ui,sans-serif;color:#176e61;margin:0 0 12px}.moveide-tour-dialog{position:fixed;margin:0;background:#fffdf7}.moveide-tour-dialog h2{font:600 25px/1.25 system-ui,sans-serif;color:inherit;margin:12px 0}.moveide-tour-dialog p{margin:12px 0 20px}.moveide-tour-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.moveide-tour-progress{font-size:13px;color:#456760}.moveide-tour-dialog .moveide-tour-primary,.moveide-tour-root .moveide-tour-primary{background:#176e61;color:#fff;border-color:#176e61}.moveide-tour-dialog button:disabled{opacity:.45;cursor:default}.moveide-tour-note{font-size:13px;color:#456760;border-top:1px solid #dbe7e3;padding-top:12px}
@media(max-width:440px){.moveide-tour-root{right:12px;bottom:12px}.moveide-tour-dialog{padding:20px}}
`;

/** Optional local walkthrough. No permission prompts, network requests or product actions. */
export function mountQuickTour({ surface = 'recorded', document = globalThis.document, storage } = {}) {
  const win = document.defaultView;
  if (document.querySelector('[data-moveide-tour]')) return () => {};
  try { storage ??= win.localStorage; } catch { /* A restricted browser still gets a dismissible tour. */ }
  const steps = [
    { title: 'Choose how to try it', text: surface === 'live'
      ? 'Choose a Mac camera or iPhone link, then Start coached squat. For iPhone, open the private link in Safari and tap Start camera. Camera access happens only when you choose it.'
      : 'Tap Try a sample squat to start automatically, or upload a side-view clip. Compare examples shows two recordings. Live camera opens the Mac or paired iPhone workflow.' },
    { title: 'Watch the local form check', text: 'Heavy loads locally; the first run may take longer. Follow the progress messages. Keep your whole body side-on. The chart shows estimated angles; gaps mean tracking or that measurement is unavailable.' },
    { title: 'Let the coach finish', text: 'Coaching needs an eligible connected ChatGPT account. Local measurements work without it. Live queues up to 6 rep reviews. Stop ends capture; keep this page open for pending notes. New Start cancels unfinished reviews.' },
    { title: 'Replay and revisit', text: 'With saving enabled, History keeps video, measurements and accepted notes on this computer—even for iPhone sessions. Live Stop keeps your replay visible. Pending reviews open History separately so coaching can finish.', note: 'Selected images and measurements reach ChatGPT; full video stays local. Live replay timing is approximate. Closing the original live page interrupts pending reviews.' },
  ];
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
  const style = element('style'); style.textContent = STYLE;
  const root = element('div', null, 'moveide-tour-root'); root.dataset.moveideTour = 'true';
  const reopen = element('button', 'Quick tour', 'moveide-tour-open'); reopen.type = 'button'; reopen.setAttribute('aria-haspopup', 'dialog'); root.append(reopen);
  const dialog = element('dialog', null, 'moveide-tour-dialog'); dialog.setAttribute('aria-labelledby', 'moveide-tour-title'); dialog.setAttribute('aria-describedby', 'moveide-tour-text');
  const top = element('div', null, 'moveide-tour-top'), progress = element('span', '', 'moveide-tour-progress'), close = element('button', 'Close'); close.type = 'button'; close.setAttribute('aria-label', 'Close quick tour'); progress.setAttribute('aria-live', 'polite'); top.append(progress, close);
  const pointer = element('div', '', 'moveide-tour-pointer');
  const title = element('h2'); title.id = 'moveide-tour-title'; const text = element('p'); text.id = 'moveide-tour-text'; const note = element('p', '', 'moveide-tour-note');
  const actions = element('div', null, 'moveide-tour-actions'), back = element('button', 'Back'), next = element('button', 'Next', 'moveide-tour-primary'); back.type = next.type = 'button'; actions.append(back, next); dialog.append(pointer, top, title, text, note, actions);
  let invitation, index = 0, returnFocus, target, layoutFrame;
  const visible = node => node && node.getClientRects().length && !node.hidden;
  const named = pattern => [...document.querySelectorAll('main button,main a')].find(node => visible(node) && pattern.test(node.textContent.trim()));
  const anchor = () => {
    const choices = surface === 'live'
      ? [document.querySelector('#start'), document.querySelector('#live-trends-title'), document.querySelector('#ai'), document.querySelector('a[href="/#history"]')]
      : [named(/^Try a sample squat/), document.querySelector('.model-select') ?? document.querySelector('.trace figcaption'), named(/^Connect ChatGPT/) ?? document.querySelector('.start-disclosure'), document.querySelector('a[href="#history"]')];
    return visible(choices[index]) ? choices[index] : named(/^Recorded clip/) ?? null;
  };
  const labels = surface === 'live' ? ['Start coached squat', 'Your movement over time', 'Coach notes', 'History'] : ['Try a sample squat', 'Local analysis', 'ChatGPT coach setup', 'History'];
  const clearTarget = () => { target?.classList.remove('moveide-tour-target'); target = null; };
  const position = () => {
    if (!dialog.open) return;
    const box = target?.getBoundingClientRect();
    const width = Math.min(440, win.innerWidth - 32);
    dialog.style.width = `${width}px`;
    if (!box) { dialog.style.maxHeight = `${win.innerHeight - 32}px`; dialog.style.left = '16px'; dialog.style.top = '16px'; pointer.textContent = 'Explore this step when its controls are available'; return; }
    const below = win.innerHeight - box.bottom - 28, above = box.top - 28;
    const putBelow = below >= above;
    dialog.style.maxHeight = `${Math.max(140, putBelow ? below : above)}px`;
    const height = dialog.getBoundingClientRect().height;
    dialog.style.top = `${putBelow ? box.bottom + 16 : Math.max(16, box.top - height - 16)}px`;
    dialog.style.left = `${Math.max(16, Math.min(win.innerWidth - width - 16, box.left))}px`;
    const label = target?.matches('nav a') ? target.textContent.trim() : labels[index];
    pointer.textContent = `${putBelow ? '↑' : '↓'} ${label} · highlighted on the page`;
  };
  const spotlight = () => {
    clearTarget(); target = anchor();
    if (target) { target.classList.add('moveide-tour-target'); target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); }
    cancelAnimationFrame(layoutFrame); layoutFrame = win.requestAnimationFrame(position);
  };
  const dismiss = () => { invitation?.remove(); invitation = null; try { storage?.setItem(PREFERENCE, 'yes'); } catch { /* Local preference is optional. */ } };
  const render = () => { progress.textContent = `Quick tour · ${index + 1} of ${steps.length}`; title.textContent = steps[index].title; text.textContent = steps[index].text; note.textContent = steps[index].note ?? ''; note.hidden = !steps[index].note; back.disabled = index === 0; next.textContent = index === steps.length - 1 ? 'Done' : 'Next'; if (dialog.open) spotlight(); };
  const open = () => { returnFocus = document.activeElement; if (invitation?.contains(returnFocus)) returnFocus = reopen; dismiss(); index = 0; render(); dialog.showModal(); spotlight(); close.focus(); };
  const finish = () => { dismiss(); clearTarget(); dialog.close(); };
  reopen.onclick = open; close.onclick = finish;
  back.onclick = () => { index = Math.max(0, index - 1); render(); };
  next.onclick = () => { if (index === steps.length - 1) finish(); else { index++; render(); } };
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  dialog.addEventListener('close', () => { (returnFocus?.isConnected ? returnFocus : reopen).focus(); });
  const routeChanged = () => { if (win.location.hash === '#history' || new URLSearchParams(win.location.search).has('session')) { invitation?.remove(); invitation = null; } };
  let navigationTimer;
  const afterNavigation = () => { clearTimeout(navigationTimer); navigationTimer = setTimeout(routeChanged, 0); };
  document.addEventListener('click', afterNavigation);
  win.addEventListener('hashchange', routeChanged); win.addEventListener('popstate', routeChanged);
  win.addEventListener('resize', position);
  win.addEventListener('scroll', position, { passive: true });
  let seen = false; try { seen = storage?.getItem(PREFERENCE) === 'yes'; } catch { /* No persisted preference. */ }
  const reviewingSavedSession = win.location.hash === '#history' || new URLSearchParams(win.location.search).has('session');
  if (!seen && !reviewingSavedSession) {
    invitation = element('section', null, 'moveide-tour-invitation'); invitation.setAttribute('aria-label', 'Quick tour invitation');
    const buttons = element('div', null, 'moveide-tour-actions'), later = element('button', 'Not now'), begin = element('button', 'Take the tour', 'moveide-tour-primary'); later.type = begin.type = 'button';
    later.onclick = () => { dismiss(); reopen.focus(); }; begin.onclick = open; buttons.append(later, begin); invitation.append(element('p', 'New here? Four quick steps.'), buttons); root.append(invitation);
  }
  document.head.append(style); document.body.append(root, dialog);
  return () => { clearTarget(); cancelAnimationFrame(layoutFrame); clearTimeout(navigationTimer); document.removeEventListener('click', afterNavigation); win.removeEventListener('hashchange', routeChanged); win.removeEventListener('popstate', routeChanged); win.removeEventListener('resize', position); win.removeEventListener('scroll', position); if (dialog.open) dialog.close(); root.remove(); dialog.remove(); style.remove(); };
}
