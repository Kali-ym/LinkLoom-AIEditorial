import { redirect } from 'next/navigation';

interface Props {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AllRedirect({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) q.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) {
        if (v) q.append(key, v);
      }
    }
  }
  const qs = q.toString();
  redirect(qs ? `/feed?${qs}` : '/feed');
}
