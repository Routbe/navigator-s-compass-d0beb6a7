import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BadgeCheck, ChevronDown, Plus } from "lucide-react";
import { BrandIcon } from "@/components/integrations/BrandIcon";
import { integrationById } from "@/lib/integrations-catalog";
import { LIVE_CAPABLE_PROVIDERS } from "@/lib/live-presence-rules";
import { getMyIntegrations, removeIntegration, saveIntegration } from "@/lib/integrations.functions";
import { disconnectSpotifyPresence, getMyPresence, setSpotifyPresenceScope, testSpotifyPresence } from "@/lib/presence.functions";
import { ProfileScope } from "@/components/studio/IntegrationVault";
import { AddLiveIntegrationModal } from "@/components/studio/AddLiveIntegrationModal";

/** Telt de actieve live diensten (Spotify + kluisrijen met live data). */
export function useLiveIntegrationCount(): number {
  const fetchPresence = useServerFn(getMyPresence);
  const fetchMine = useServerFn(getMyIntegrations);
  const presence = useQuery({ queryKey: ["my-presence"], queryFn: () => fetchPresence(), retry: false });
  const mine = useQuery({ queryKey: ["my-integrations"], queryFn: () => fetchMine(), retry: false });
  const spotify = presence.data?.connections.some((c) => c.provider === "spotify") ? 1 : 0;
  const rows = (mine.data?.ready ? mine.data.items : []).filter((r) => LIVE_CAPABLE_PROVIDERS.includes(r.provider));
  return spotify + rows.length;
}

function scopeBadge(verified: boolean, alias: boolean): string {
  if (verified && alias) return "Beide profielen";
  if (verified) return "Geverifieerd profiel";
  if (alias) return "Privacy Alias";
  return "Verborgen";
}

/** Ingeklapte rij: logo, naam, account, badge en uitklapknop. */
function Row({ icon, label, account, verified, badge, children }: {
  icon: string | null; label: string; account: string; verified?: boolean; badge: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center gap-2 p-3 text-left"
      >
        <BrandIcon icon={icon} />
        <span className="text-sm font-medium">{label}</span>
        {verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Geverifieerd" />}
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{account}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{badge}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && <div className="space-y-2 border-t border-border p-3">{children}</div>}
    </div>
  );
}

const btn = "inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50";

/**
 * ⚡ Live Integraties: gekoppelde diensten met live data, standaard ingeklapt.
 * Opengeklapt: per profiel tonen, testen (Spotify) en ontkoppelen.
 */
export function LiveIntegrations() {
  const qc = useQueryClient();
  const fetchPresence = useServerFn(getMyPresence);
  const fetchMine = useServerFn(getMyIntegrations);
  const save = useServerFn(saveIntegration);
  const remove = useServerFn(removeIntegration);
  const setScope = useServerFn(setSpotifyPresenceScope);
  const testSpotify = useServerFn(testSpotifyPresence);
  const unlinkSpotify = useServerFn(disconnectSpotifyPresence);
  const presence = useQuery({ queryKey: ["my-presence"], queryFn: () => fetchPresence(), retry: false });
  const mine = useQuery({ queryKey: ["my-integrations"], queryFn: () => fetchMine(), retry: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const spotify = presence.data?.connections.find((c) => c.provider === "spotify");
  const rows = (mine.data?.ready ? mine.data.items : []).filter((r) => LIVE_CAPABLE_PROVIDERS.includes(r.provider));

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Live kaarten verschijnen alleen bij recent gebruik: Spotify tijdens het afspelen; GitHub, GitLab, Mastodon, Bluesky en W.social bij activiteit in de laatste 24 uur.
      </p>
      {!spotify && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nog geen live diensten gekoppeld.
        </p>
      )}
      {spotify && (
        <Row icon="siSpotify" label="Spotify" account={spotify.accountName ?? "Gekoppeld"} badge={scopeBadge(spotify.showOnVerified, spotify.showOnAlias)}>
          <ProfileScope
            label="Spotify"
            verified={spotify.showOnVerified}
            alias={spotify.showOnAlias}
            disabled={busy === "spotify"}
            onChange={(v) => void run("spotify", async () => {
              await setScope({ data: v });
              await qc.invalidateQueries({ queryKey: ["my-presence"] });
            })}
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy === "spotify"} className={btn}
              onClick={() => void run("spotify", async () => {
                const r = await testSpotify();
                (r.ok ? toast.success : toast.error)(r.message, { duration: 10000 });
              })}>
              Test verbinding
            </button>
            <button type="button" disabled={busy === "spotify"} className={`${btn} text-destructive`}
              onClick={() => void run("spotify", async () => {
                await unlinkSpotify();
                await qc.invalidateQueries({ queryKey: ["my-presence"] });
                toast.success("Spotify ontkoppeld");
              })}>
              Ontkoppelen
            </button>
          </div>
        </Row>
      )}
      {rows.map((row) => {
        const item = integrationById(row.provider);
        if (!item) return null;
        return (
          <Row key={row.provider} icon={item.icon} label={item.label} account={`@${row.handle.replace(/^@/, "")}`}
            verified={row.verified} badge={scopeBadge(row.showOnVerified, row.showOnAlias)}>
            <ProfileScope
              label={item.label}
              verified={row.showOnVerified}
              alias={row.showOnAlias}
              disabled={busy === row.provider}
              onChange={(v) => void run(row.provider, async () => {
                await save({ data: { provider: row.provider, handle: row.handle, audience: row.audience, visible: row.visible, useSso: row.verified, showOnVerified: v.verified, showOnAlias: v.alias } });
                await qc.invalidateQueries({ queryKey: ["my-integrations"] });
              })}
            />
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[11px] text-muted-foreground">
                Status: {row.verified ? "Geverifieerd ✅" : "Handmatig"}
              </span>
              <button type="button" disabled={busy === row.provider} className={`${btn} flex-none px-3 text-destructive`}
                onClick={() => void run(row.provider, async () => {
                  await remove({ data: { provider: row.provider } });
                  await qc.invalidateQueries({ queryKey: ["my-integrations"] });
                  toast.success(`${item.label} ontkoppeld`);
                })}>
                Ontkoppelen
              </button>
            </div>
          </Row>
        );
      })}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium transition-colors hover:bg-muted"
      >
        <Plus className="h-4 w-4" aria-hidden /> Live integratie toevoegen
      </button>
      <AddLiveIntegrationModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
