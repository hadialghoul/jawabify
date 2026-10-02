// Settings → Quick answers: business-written text or pre-recorded voice notes
// sent verbatim when a customer asks one of the listed common questions.
// Runs for every vertical before the AI/flow reply.

interface QaCtx {
  supabase: any;
  tenantId: string;
  contactId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  messageText: string | null;
}

async function matchQuestion(text: string, questions: { id: string; question: string }[]): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const list = questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions:
          "You match a customer's WhatsApp message (any language, including Arabic and Arabizi) to a list of common questions. " +
          "Reply with ONLY the number of the question that asks the same thing, or 0 if none clearly matches. " +
          "Messages that only greet, place an order, or ask something different must be 0.",
        input: `Questions:\n${list}\n\nCustomer message: """${text.slice(0, 1000)}"""`,
      }),
    });
    if (!res.ok) {
      console.error("quick-answer match failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    let out: string = data.output_text || "";
    if (!out && Array.isArray(data.output)) {
      for (const item of data.output) for (const c of item.content || []) if (c.text) out += c.text;
    }
    const n = parseInt((out.match(/\d+/) || ["0"])[0], 10);
    return n >= 1 && n <= questions.length ? questions[n - 1].id : null;
  } catch (e) {
    console.error("quick-answer match error", e);
    return null;
  }
}

async function graphSend(ctx: QaCtx, payload: Record<string, unknown>) {
  return fetch(`https://graph.facebook.com/v21.0/${ctx.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: ctx.phoneNumber, ...payload }),
  });
}

async function uploadAudio(ctx: QaCtx, url: string, mime: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    const type = (mime || blob.type || "audio/mpeg").split(";")[0];
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", type);
    form.append("file", new Blob([await blob.arrayBuffer()], { type }), "voice." + (type.split("/")[1] || "mp3"));
    const up = await fetch(`https://graph.facebook.com/v21.0/${ctx.phoneNumberId}/media`, {
      method: "POST", headers: { Authorization: `Bearer ${ctx.accessToken}` }, body: form,
    });
    if (!up.ok) { console.error("audio upload failed", up.status, await up.text()); return null; }
    return (await up.json()).id || null;
  } catch (e) {
    console.error("audio upload error", e);
    return null;
  }
}

/** Sends a matching quick answer. Returns true when it replied. */
export async function tryQuickAnswer(ctx: QaCtx): Promise<boolean> {
  const text = (ctx.messageText || "").trim();
  if (!ctx.tenantId || text.length < 2) return false;
  const { data: rows } = await ctx.supabase
    .from("quick_answers")
    .select("id, question, answer_type, answer_text, audio_url, audio_mime")
    .eq("tenant_id", ctx.tenantId)
    .eq("enabled", true)
    .limit(50);
  const usable = (rows || []).filter((r: any) =>
    r.question?.trim() && (r.answer_type === "voice" ? !!r.audio_url : !!r.answer_text?.trim()),
  );
  if (!usable.length) return false;

  const id = await matchQuestion(text, usable);
  const qa = usable.find((r: any) => r.id === id);
  if (!qa) return false;
  console.log("Quick answer matched", qa.id);

  if (qa.answer_type === "voice") {
    const mediaId = await uploadAudio(ctx, qa.audio_url, qa.audio_mime);
    const res = await graphSend(ctx, { type: "audio", audio: mediaId ? { id: mediaId } : { link: qa.audio_url } });
    if (!res.ok) { console.error("voice send failed", res.status, await res.text()); return false; }
    await ctx.supabase.from("messages").insert({
      contact_id: ctx.contactId, content: "🎤 Voice note", direction: "outgoing", status: "sent",
      media_url: qa.audio_url, media_type: qa.audio_mime || "audio/mpeg",
    });
    if (qa.answer_text?.trim()) {
      await graphSend(ctx, { type: "text", text: { body: qa.answer_text } });
      await ctx.supabase.from("messages").insert({ contact_id: ctx.contactId, content: qa.answer_text, direction: "outgoing", status: "sent" });
    }
    return true;
  }

  const res = await graphSend(ctx, { type: "text", text: { body: qa.answer_text } });
  if (!res.ok) { console.error("quick text send failed", res.status, await res.text()); return false; }
  await ctx.supabase.from("messages").insert({ contact_id: ctx.contactId, content: qa.answer_text, direction: "outgoing", status: "sent" });
  return true;
}
