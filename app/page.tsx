"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["pdf", "jpg", "jpeg", "png"];
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [sentName, setSentName] = useState("");

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    let problem = "";

    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(getExt(f.name))) {
        problem = `${f.name} isn't supported. Use PDF, JPG or PNG.`;
        continue;
      }
      if (f.size > MAX_BYTES) {
        problem = `${f.name} is over 25 MB. Choose a smaller file.`;
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }

    setFiles(next);
    setError(problem);
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  async function handleSend() {
    setError("");
    if (!name.trim()) return setError("Enter your name so we know whose files these are.");
    if (files.length === 0) return setError("Choose at least one file to send.");

    setLoading(true);
    try {
      const json = { "Content-Type": "application/json" };

      // 1) Get permission to upload
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          name: name.trim(),
          files: files.map((f) => ({ name: f.name, size: f.size })),
        }),
      });
      const init = await initRes.json();
      if (!initRes.ok) throw new Error(init.error || "Upload failed. Try again.");

      // 2) Upload straight to Supabase
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const { error: upErr } = await supabaseBrowser.storage
          .from("customer-uploads")
          .uploadToSignedUrl(init.uploads[i].path, init.uploads[i].token, f, {
            contentType: MIME[getExt(f.name)],
          });
       if (upErr) {
  console.error("Upload error:", upErr);
  throw new Error(`Couldn't upload ${f.name}: ${upErr.message}`);
  } }

      // 3) Finish
      const doneRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          submissionId: init.submissionId,
          name: name.trim(),
          count: files.length,
        }),
      });
      const done = await doneRes.json();
      if (!doneRes.ok) throw new Error(done.error || "Upload failed. Try again.");

      setSentCount(files.length);
      setSentName(name.trim());
      setSubmissionId(init.submissionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFiles([]);
    setSubmissionId("");
    setError("");
  }

  const brand = (
    <header className="brand">
      <span className="marks" aria-hidden="true">
        <i className="c" />
        <i className="m" />
        <i className="y" />
        <i className="k" />
      </span>
      <span>B Flex Printing</span>
    </header>
  );

  if (submissionId) {
    return (
      <main className="page">
        {brand}
        <h1>Files sent.</h1>
        <p className="lead">
          Your files are with B Flex Printing. Quote this ID if you need to ask about them.
        </p>

        <div className="ticket">
          <p className="ticket-label">Submission ID</p>
          <p className="ticket-id">{submissionId}</p>
          <p className="ticket-meta">
            {sentName}, {sentCount} {sentCount === 1 ? "file" : "files"}
          </p>
        </div>

        <button className="again" onClick={reset}>
          Send more files
        </button>
      </main>
    );
  }

  return (
    <main className="page">
      {brand}
      <h1>Send us your files.</h1>
      <p className="lead">Upload your PDFs or photos from your phone. We'll take it from here.</p>

      <div className="field">
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="e.g. Rahul"
        />
      </div>

      <div className="field">
        <span className="label">Your files</span>
        <div className="sheet">
          <span className="crop tl" />
          <span className="crop tr" />
          <span className="crop bl" />
          <span className="crop br" />
          <label className="drop">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="drop-title">{files.length ? "Add more files" : "Choose files"}</span>
            <span className="drop-hint">PDF, JPG or PNG, up to 25 MB each</span>
          </label>
        </div>

        {files.length > 0 && (
          <ul className="files">
            {files.map((f, i) => {
              const ext = getExt(f.name);
              return (
                <li className="file" key={`${f.name}-${f.size}`}>
                  <span className={`badge ${ext === "pdf" ? "pdf" : "img"}`}>
                    {ext === "jpeg" ? "jpg" : ext}
                  </span>
                  <span className="file-meta">
                    <span className="file-name">{f.name}</span>
                    <span className="file-size">{formatSize(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => removeFile(i)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button className="send" onClick={handleSend} disabled={loading}>
        {loading ? "Sending…" : files.length > 1 ? `Send ${files.length} files` : "Send files"}
      </button>
    </main>
  );
}