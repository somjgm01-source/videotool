import { useState } from 'react';
import { Film, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ClipLibrary from '@/components/ClipLibrary';
import StudioView from '@/components/StudioView';
import type { Clip } from '@/lib/clips';

type Props = {
  userId: string;
  userEmail: string;
};

export default function AppShell({ userId, userEmail }: Props) {
  const [openClip, setOpenClip] = useState<Clip | null>(null);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpenClip(null)}
            className="flex items-center gap-3 rounded-lg transition hover:opacity-90"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
              <Film className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-50">Match Lens</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">{userEmail}</span>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {openClip ? (
          <StudioView key={openClip.id} clip={openClip} onBack={() => setOpenClip(null)} />
        ) : (
          <ClipLibrary userId={userId} onOpen={setOpenClip} />
        )}
      </main>
    </div>
  );
}
