// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { LanguageProvider } from './i18n';
import { PRESETS } from './data';
import { BACKUP_KEY, decodeLibrary, RECOVERY_PREFIX, STORAGE_KEY } from './services/storage';

// The unrelated sources dialog uses native dialog methods absent from jsdom.
vi.mock('./components/SourcesDialog', () => ({ SourcesDialog: () => null }));

let root: Root;
let element: HTMLDivElement;
const initial = () => ({
  version: 1,
  activeId: 'mine',
  plans: [{ ...PRESETS[0], id: 'mine', name: 'My saved layout', updatedAt: 1 }],
});
const button = (label: string) => {
  const result = [...element.querySelectorAll('button')].find((b) => b.textContent === label);
  expect(result, `button: ${label}`).toBeDefined();
  return result!;
};
async function mount() {
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
  await act(async () => {
    root.render(createElement(LanguageProvider, null, createElement(App)));
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  localStorage.setItem('everdale.locale', 'en');
  let queue: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: <T>(_name: string, task: () => T) => {
        const next = queue.then(task);
        queue = next.catch(() => {});
        return next;
      },
    },
  });
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  element.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('shows a persistent recovery notice and only replaces damaged data after confirmation', async () => {
  localStorage.setItem(STORAGE_KEY, '{damaged');
  localStorage.setItem(BACKUP_KEY, JSON.stringify(initial()));
  await mount();
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('previous valid backup');
  expect(element.querySelector('.save-status')?.textContent).toBe('Not saved');
  button('Export all layouts');
  button('Download original save');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await act(async () => {
    button('Resume saving').click();
  });
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{damaged');
  confirm.mockReturnValue(true);
  await act(async () => {
    button('Resume saving').click();
  });
  expect(decodeLibrary(localStorage.getItem(STORAGE_KEY)!)).toEqual(initial());
  expect(Object.keys(localStorage).some((key) => key.startsWith(RECOVERY_PREFIX))).toBe(true);
  expect(element.querySelector('[role="alert"]')).toBeNull();
  expect(element.querySelector('.save-status')?.textContent).toBe('Saved');
});

it('keeps unsaved UI edits until the user confirms loading the other page’s version', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial()));
  await mount();
  const grove = element.querySelector('svg[role="group"] [role="button"]')!;
  await act(async () => {
    grove.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  expect(element.querySelector('.grove.grown')).not.toBeNull();
  const remote = initial();
  remote.plans[0].name = 'Other page';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  });
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('Another page');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await act(async () => {
    button('Load latest save').click();
  });
  expect(element.querySelector('.grove.grown')).not.toBeNull();
  confirm.mockReturnValue(true);
  await act(async () => {
    button('Load latest save').click();
  });
  expect(element.querySelector('.grove.grown')).toBeNull();
  expect(element.querySelector<HTMLInputElement>('input[aria-label="Layout name"]')?.value).toBe(
    'Other page',
  );
  expect(element.querySelector('[role="alert"]')).toBeNull();
});
