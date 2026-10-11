import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "customer-uploads";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["pdf", "jpg", "jpeg", "png"];

function makeSubmissionId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return "BF-" + id;
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  const { name, files } = await req.json();

  if (!name || !String(name).trim())
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!Array.isArray(files) || files.length === 0)
    return NextResponse.json({ error: "Select at least one file." }, { status: 400 });

  const submissionId = makeSubmissionId();
  const used = new Set<string>();
  const uploads: { path: string; token: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = String(f.name).split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext))
      return NextResponse.json({ error: `${f.name}: only PDF, JPG, PNG allowed.` }, { status: 400 });
    if (typeof f.size !== "number" || f.size > MAX_BYTES)
      return NextResponse.json({ error: `${f.name} is larger than 25 MB.` }, { status: 400 });

    let clean = cleanFileName(String(f.name));
    if (used.has(clean)) clean = `${i + 1}_${clean}`;
    used.add(clean);

    const path = `${submissionId}/${clean}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data)
      return NextResponse.json({ error: "Could not start upload. Try again." }, { status: 500 });

    uploads.push({ path, token: data.token });
  }

  return NextResponse.json({ submissionId, uploads });
}