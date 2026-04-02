"use client";

import { useState } from "react";

export default function PornPage() {
  const [clicked, setClicked] = useState(false);

  async function handleClick() {
    await fetch("/api/desktop-ping", { method: "POST" });
    setClicked(true);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      {clicked ? (
        <p className="text-xl font-semibold text-slate-200">Thank you!</p>
      ) : (
        <>
          <p className="text-slate-300 text-lg max-w-md leading-relaxed">
            Oh, someone does use desktop. Just checking.
          </p>
          <button
            onClick={handleClick}
            className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors"
          >
            👋 Please let Mike know
          </button>
        </>
      )}
    </div>
  );
}
