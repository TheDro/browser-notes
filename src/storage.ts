import type { Annotation } from './types';

const KEY = 'annotations';

export async function getAnnotations(): Promise<Annotation[]> {
  const result = await chrome.storage.local.get(KEY);
  console.log({annotations: result})
  return (result[KEY] as Annotation[] | undefined) ?? [];
}

async function setAnnotations(annotations: Annotation[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: annotations });
}

export async function saveAnnotation(annotation: Annotation): Promise<void> {
  const all = await getAnnotations();
  await setAnnotations([...all, annotation]);
}

export async function updateAnnotation(updated: Annotation): Promise<void> {
  const all = await getAnnotations();
  await setAnnotations(all.map((a) => (a.id === updated.id ? updated : a)));
}

export async function deleteAnnotation(id: string): Promise<void> {
  const all = await getAnnotations();
  await setAnnotations(all.filter((a) => a.id !== id));
}
