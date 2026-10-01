import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Page not found</h2>
          <p className="text-xs text-slate-400 mt-1">The page you are looking for does not exist or has moved.</p>
        </div>
        <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold hover:bg-indigo-500">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
