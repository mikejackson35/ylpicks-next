"use client";

import { useEffect, useState } from "react";

type Post = {
  tournament_id: string;
  tournament_name: string;
  content: string;
  created_at: string;
};

export default function BlogClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-white mb-1">The Raw Room</h2>
        <div className="mb-8" />
        <p className="text-slate-500 text-sm">The The Raw Room is a blog for blogsters and others in the league so stay tuned for that maybe</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold text-white mb-1">The Raw Room</h2>
      <p className="text-xs text-slate-400 mb-8">AI-generated weekly recaps</p>

      <div className="flex flex-col gap-10">
        {posts.map((post) => (
          <article key={post.tournament_id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-base font-semibold text-emerald-400 mb-1">{post.tournament_name}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {new Date(post.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="text-sm text-slate-300 leading-relaxed space-y-4">
              {post.content.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
