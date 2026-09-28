import { redirect } from 'next/navigation';

/** La vitrine utilise l'application réelle en mode démonstration. */
export default function DemoPage() {
  redirect('/');
}
