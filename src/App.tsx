import { Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import AuthScreen from '@/components/AuthScreen';
import { useAuth } from '@/hooks/useAuth';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-hidden="true" />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return <AppShell userId={session.user.id} userEmail={session.user.email ?? ''} />;
}
