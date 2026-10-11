import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "customer-uploads";

export async function POST(req: Request) {
  const { submissionId, name, count } = await req.json();

  if (!/^BF-[A-Z0-9]{5}$/.test(String(submissionId)) || !name)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Make sure every file really arrived before the receiver can see this submission
  const { data: stored, error: listError } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(submissionId, { limit: 100 });

  if (listError || !stored || stored.length < Number(count))
    return NextResponse.json({ error: "Some files didn't finish uploading. Try again." }, { status: 400 });

  const { error: dbError } = await supabaseAdmin.from("submissions").insert({
    submission_id: submissionId,
    customer_name: String(name).trim(),
    status: "PENDING",
  });

  if (dbError)
    return NextResponse.json({ error: "Could not save your submission. Try again." }, { status: 500 });

  return NextResponse.json({ ok: true });
}