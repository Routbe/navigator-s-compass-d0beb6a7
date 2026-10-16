import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { EyeOff, Send, Trash2 } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { answerMyQuestion, deleteMyQuestion, getMyQuestions, setMyQuestionsEnabled, unpublishMyQuestion } from "@/lib/questions.functions";
import { ANSWER_MAX } from "@/lib/questions-rules";

/** Studio inbox: anonymous questions; answering + "Publiceer" puts them on the public profile. */
export function QuestionsInboxAccordion() {
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyQuestions);
  const answer = useServerFn(answerMyQuestion);
  const unpublish = useServerFn(unpublishMyQuestion);
  const del = useServerFn(deleteMyQuestion);
  const setEnabled = useServerFn(setMyQuestionsEnabled);
  const q = useQuery({ queryKey: ["my-questions"], queryFn: () => fetchMine(), retry: false });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const items = q.data?.questions ?? [];
  const open = items.filter((i) => !i.published).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-questions"] });

  const publish = async (id: string) => {
    const text = drafts[id] ?? items.find((i) => i.id === id)?.answer ?? "";
    const { result } = await answer({ data: { id, answer: text, publish: true } });
    if (result === "ok") {
      toast.success("Gepubliceerd op je profiel");
      void refresh();
    } else toast.error("Schrijf eerst een antwoord (max 1000 tekens).");
  };

  return (
    <AccordionItem value="questions" className="rounded-2xl border border-border bg-card px-4 sm:px-5">
      <AccordionTrigger className="hover:no-underline">
        <span className="text-left">
          <span className="block text-sm font-medium">Inbox · Anonieme vragen</span>
          <span className="block text-xs text-muted-foreground">{items.length} vragen · {open} open</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-5">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
          <span>
            <span className="block font-medium">Anonieme vragen op mijn profiel</span>
            <span className="block text-xs text-muted-foreground">Uit = het blok is verborgen en er komen geen nieuwe vragen binnen.</span>
          </span>
          <Switch
            checked={q.data?.enabled !== false}
            onCheckedChange={async (v) => {
              await setEnabled({ data: { enabled: v } });
              toast.success(v ? "Vragen staan aan" : "Vragen staan uit");
              void refresh();
            }}
          />
        </label>
        {items.length === 0 && <p className="text-xs text-muted-foreground">Nog geen vragen. Bezoekers kunnen er anoniem een stellen op je profiel.</p>}
        {items.map((it) => (
          <div key={it.id} className={`space-y-2 rounded-xl border p-3 ${it.published ? "border-primary/50 bg-primary/5" : "border-border"}`}>
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 break-words text-sm font-medium">{it.body}</p>
              <button type="button" aria-label="Verwijderen" className="text-muted-foreground hover:text-destructive" onClick={async () => { await del({ data: { id: it.id } }); void refresh(); }}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{new Date(it.createdAt).toLocaleString("nl-BE")}</p>
            <textarea
              value={drafts[it.id] ?? it.answer ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: e.target.value.slice(0, ANSWER_MAX) }))}
              rows={2}
              placeholder="Typ je antwoord…"
              aria-label="Antwoord"
              className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => publish(it.id)}><Send className="mr-1 h-3.5 w-3.5" />{it.published ? "Bijwerken" : "Publiceer"}</Button>
              {it.published && (
                <Button size="sm" variant="outline" onClick={async () => { await unpublish({ data: { id: it.id } }); void refresh(); }}>
                  <EyeOff className="mr-1 h-3.5 w-3.5" />Verbergen
                </Button>
              )}
            </div>
          </div>
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}
