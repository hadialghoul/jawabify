import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, UserRound, Sparkles, Check, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Incident {
  id: string;
  contact_id: string | null;
  incident_type: "failure" | "low_confidence" | "handoff" | "escalation";
  reason: string | null;
  user_message: string | null;
  ai_reply: string | null;
  model: string | null;
  metadata: any;
  resolved: boolean;
  created_at: string;
  contacts?: { name: string | null; phone_number: string | null } | null;
}

const typeMeta: Record<Incident["incident_type"], { label: string; icon: any; color: string }> = {
  failure: { label: "AI Failure", icon: AlertTriangle, color: "text-destructive" },
  low_confidence: { label: "Low Confidence", icon: AlertCircle, color: "text-amber-500" },
  handoff: { label: "Human Handoff", icon: UserRound, color: "text-blue-500" },
  escalation: { label: "Escalation", icon: Sparkles, color: "text-purple-500" },
};

export function AIIssuesTab({ onSelectContact }: { onSelectContact?: (phone: string) => void }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | Incident["incident_type"]>("open");
  const { tenantId } = useAuth();

  const load = useCallback(async () => {
    if (!tenantId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_incidents" as any)
        .select("*, contacts(name, phone_number)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        toast.error(`Failed to load AI issues: ${error.message}`);
      } else {
        setItems((data as unknown as Incident[]) || []);
      }
    } catch (e: any) {
      toast.error(`Failed to load AI issues: ${e?.message || "network error"}`);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`ai_incidents_changes_${tenantId ?? "none"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_incidents", filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined } as any, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, tenantId]);

  const filtered = items.filter((i) => {
    if (filter === "all") return true;
    if (filter === "open") return !i.resolved;
    return i.incident_type === filter;
  });

  const markResolved = async (id: string, resolved: boolean) => {
    // Optimistic flip so the UI responds immediately.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved } : i)));
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // RLS already scopes rows to this tenant; no extra tenant filter needed.
        const { data, error } = await supabase
          .from("ai_incidents" as any)
          .update({ resolved })
          .eq("id", id)
          .select("id");
        if (!error && data && (data as any[]).length > 0) {
          lastError = null;
          break;
        }
        lastError = error || new Error("Issue not found or not permitted");
      } catch (e) {
        lastError = e;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
    if (lastError) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: !resolved } : i)));
      toast.error(`Failed to update: ${lastError?.message || "unknown error"}`);
    }
  };

  const remove = async (id: string) => {
    const prevItems = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const { error } = await supabase.from("ai_incidents" as any).delete().eq("id", id);
      if (error) throw error;
    } catch (e: any) {
      setItems(prevItems);
      toast.error(`Failed to delete: ${e?.message || "unknown error"}`);
    }
  };


  const counts = {
    open: items.filter((i) => !i.resolved).length,
    failure: items.filter((i) => i.incident_type === "failure").length,
    low_confidence: items.filter((i) => i.incident_type === "low_confidence").length,
    handoff: items.filter((i) => i.incident_type === "handoff").length,
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            AI Issues
          </h3>
          <p className="text-sm text-muted-foreground">
            Where the AI failed, was unsure, or escalated — with full context.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="px-4 pt-3 flex flex-wrap gap-2">
        {([
          ["open", `Open (${counts.open})`],
          ["all", "All"],
          ["failure", `Failures (${counts.failure})`],
          ["low_confidence", `Low confidence (${counts.low_confidence})`],
          ["handoff", `Handoffs (${counts.handoff})`],
        ] as const).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key as any)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No issues. The AI is doing fine.</p>
            </div>
          ) : (
            filtered.map((i) => {
              const meta = typeMeta[i.incident_type];
              const Icon = meta.icon;
              const phone = i.contacts?.phone_number;
              return (
                <div
                  key={i.id}
                  className={`rounded-lg border bg-card p-4 ${i.resolved ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`h-4 w-4 ${meta.color} shrink-0`} />
                      <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                      {i.resolved && <Badge variant="secondary" className="text-xs">Resolved</Badge>}
                      <span className="text-xs text-muted-foreground truncate">
                        {new Date(i.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markResolved(i.id, !i.resolved)}
                        title={i.resolved ? "Mark open" : "Mark resolved"}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(i.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(i.contacts?.name || phone) && (
                    <button
                      type="button"
                      className="text-sm font-medium hover:underline mb-2 block text-left"
                      onClick={() => phone && onSelectContact?.(phone)}
                    >
                      {i.contacts?.name || phone} {phone && i.contacts?.name ? `· ${phone}` : ""}
                    </button>
                  )}

                  {i.reason && (
                    <p className="text-sm mb-2">
                      <span className="text-muted-foreground">Reason: </span>
                      <span className="font-medium">{i.reason}</span>
                    </p>
                  )}

                  {i.user_message && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">Customer message</p>
                      <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{i.user_message}</p>
                    </div>
                  )}

                  {i.ai_reply && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">AI reply</p>
                      <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{i.ai_reply}</p>
                    </div>
                  )}

                  {i.model && (
                    <p className="text-xs text-muted-foreground">Model: {i.model}</p>
                  )}

                  {i.metadata && Object.keys(i.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">Details</summary>
                      <pre className="text-xs bg-muted/50 rounded p-2 mt-1 overflow-x-auto">
                        {JSON.stringify(i.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
