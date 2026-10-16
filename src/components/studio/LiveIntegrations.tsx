import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { BrandIcon } from "@/components/integrations/BrandIcon";
import { integrationById } from "@/lib/integrations-catalog";
import { LIVE_CAPABLE_PROVIDERS } from "@/lib/live-presence-rules";
import { getMyIntegrations, saveIntegration } from "@/lib/integrations.functions";
import { getMyPresence, setSpotifyPresenceScope, testSpotifyPresence } from "@/lib/presence.functions";
import { ProfileScope } from "@/components/studio/IntegrationVault";

/**
 * ⚡ Live Integraties: alle in de kluis gekoppelde diensten met live data,
 * met per profiel (Geverifieerd / Privacy Alias) een schakelaar.
 */
export function LiveIntegrations() {
  const qc = useQueryClient();
  const fetchPresence = useServerFn(getMyPresence);
  const fetchMine = useServerFn(getMyIntegrations);
  const save = useServerFn(saveIntegration);
  const setScope = useServerFn(setSpotifyPresenceScope);
  const testSpotify = useServerFn(testSpotifyPresence);
  const presence = useQuery({ queryKey: ["my-presence"], queryFn: () => fetchPresence(), retry: false });
  const mine = useQuery({ queryKey: ["my-integrations"], queryFn: () => fetchMine(), retry: false });
  const [busy, setBusy] = useState<string | null>(null);

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

  if (!spotify && rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
        Nog geen live diensten gekoppeld. Voeg via <strong>+ Component toevoegen</strong> bijvoorbeeld Spotify of GitHub toe.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Live kaarten verschijnen alleen bij recent gebruik: Spotify tijdens het afspelen, GitHub en GitLab bij activiteit in de laatste 24 uur.
      </p>
      {spotify && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BrandIcon icon="siSpotify" /> Spotify
            <span className="truncate text-[11px] font-normal text-muted-foreground">{spotify.accountName ?? "Gekoppeld"}</span>
          </div>
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
          <button
            type="button"
            disabled={busy === "spotify"}
            onClick={() => void run("spotify", async () => {
              const r = await testSpotify();
              (r.ok ? toast.success : toast.error)(r.message, { duration: 10000 });
            })}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-border text-xs font-medium hover:bg-muted"
          >
            Test verbinding
          </button>
        </div>
      )}
      {rows.map((row) => {
        const item = integrationById(row.provider);
        if (!item) return null;
        return (
          <div key={row.provider} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <BrandIcon icon={item.icon} /> {item.label}
              {row.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="Geverifieerd" />}
              <span className="truncate text-[11px] font-normal text-muted-foreground">@{row.handle.replace(/^@/, "")}</span>
            </div>
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
          </div>
        );
      })}
    </div>
  );
}
