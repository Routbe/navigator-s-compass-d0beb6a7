import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { BrandIcon } from "@/components/integrations/BrandIcon";
import { integrationById } from "@/lib/integrations-catalog";
import { getMyIntegrations, saveIntegration } from "@/lib/integrations.functions";
import { getMyPresence, setSpotifyPresenceVisible } from "@/lib/presence.functions";
import { IntegrationVault } from "./IntegrationVault";
import { SocialVerifyPanel } from "@/components/dashboard/SocialVerifyPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BLOCK_KINDS } from "@/lib/profile";
import { VideoBlockDialog } from "./VideoBlockDialog";
import { ProUpgradeModal } from "./ProUpgradeModal";

/** Eén component uit de bibliotheek. `video` opent de embed/upload-keuze. */
interface LibraryItem {
  kind: string;
  label: string;
  note: string;
  isNew?: boolean;
}

interface LibraryGroup {
  id: string;
  title: string;
  items: LibraryItem[];
}

export const COMPONENT_LIBRARY: LibraryGroup[] = [
  {
    id: "standard",
    title: "🔗 Links & Socials",
    items: [
      { kind: "link", label: "Link", note: "Elke webpagina" },
      { kind: "instagram", label: "Socials", note: "Instagram, TikTok, X, …" },
      { kind: "text", label: "Tekst / Koptekst", note: "Intro, kop of aankondiging", isNew: true },
      { kind: "spacer", label: "Scheidingslijn", note: "Rust tussen secties", isNew: true },
    ],
  },
  {
    id: "media",
    title: "Media",
    items: [
      { kind: "video", label: "Video", note: "YouTube, Vimeo of TikTok", isNew: true },
      { kind: "media_gallery", label: "Afbeelding / Galerij", note: "Foto's in een raster", isNew: true },
      { kind: "spotify", label: "Spotify / Audio", note: "Track, album of podcast", isNew: true },
      { kind: "soundcloud", label: "Soundcloud", note: "Track of profiel" },
    ],
  },
  {
    id: "leads",
    title: "💬 Interactief & Widgets",
    items: [
      { kind: "newsletter", label: "Nieuwsbrief", note: "Laat bezoekers inschrijven", isNew: true },
      { kind: "contact_form", label: "Contactformulier", note: "Direct bericht", isNew: true },
      { kind: "vcard", label: "vCard", note: "Eén tik → in de contacten" },
      { kind: "live_poll", label: "Poll", note: "Stel je volgers een vraag" },
    ],
  },
  {
    id: "business",
    title: "Zakelijk & Web3",
    items: [
      { kind: "calendly", label: "Calendly-boeking", note: "Laat mensen een moment kiezen", isNew: true },
      { kind: "booking_request", label: "Boekingsaanvraag", note: "Eigen tijdslots" },
      { kind: "matrix", label: "Matrix", note: "Soeverein chatten" },
      { kind: "mastodon", label: "Fediverse", note: "Mastodon, Pixelfed, …" },
    ],
  },
];

/** Live kaarten die een koppeling uit de Integratiekluis hergebruiken. */
export const LIVE_COMPONENTS: { provider: string; note: string }[] = [
  { provider: "spotify", note: "Wat je nu luistert" },
  { provider: "github", note: "Recente pushes" },
  { provider: "gitlab", note: "Recente activiteit" },
  { provider: "wakatime", note: "Codeertijd" },
  { provider: "lichess", note: "Rating en partijen" },
  { provider: "chesscom", note: "Rating en partijen" },
  { provider: "mastodon", note: "Laatste bericht" },
  { provider: "bluesky", note: "Laatste bericht" },
  { provider: "wsocial", note: "Laatste bericht" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (kind: string, value?: string) => void;
  handle?: string;
}

/** De Component-bibliotheek: alles wat je aan je pagina kunt toevoegen. */
export function AddComponentModal({ open, onClose, onAdd, handle }: Props) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  /** null = catalogus; "all" = volledige kluis; anders één dienst. */
  const [vault, setVault] = useState<string | null>(null);
  const qc = useQueryClient();
  const fetchPresence = useServerFn(getMyPresence);
  const fetchMine = useServerFn(getMyIntegrations);
  const save = useServerFn(saveIntegration);
  const showSpotify = useServerFn(setSpotifyPresenceVisible);
  const presence = useQuery({ queryKey: ["my-presence"], queryFn: () => fetchPresence(), retry: false, enabled: open });
  const mine = useQuery({ queryKey: ["my-integrations"], queryFn: () => fetchMine(), retry: false, enabled: open });
  const spotify = presence.data?.connections.find((c) => c.provider === "spotify");
  const items = mine.data?.ready ? mine.data.items : [];
  const rowFor = (p: string) => items.find((i) => i.provider === p);

  const close = () => {
    setVault(null);
    onClose();
  };

  /** Gekoppeld → in 1 klik tonen; anders inline de kluis-koppelflow openen. */
  const pickLive = async (provider: string) => {
    const label = integrationById(provider)?.label ?? provider;
    try {
      if (provider === "spotify" && spotify) {
        await showSpotify({ data: { show: true } });
        await qc.invalidateQueries({ queryKey: ["my-presence"] });
      } else {
        const row = rowFor(provider);
        if (!row) return setVault(provider);
        const r = await save({ data: { provider, handle: row.handle, audience: row.audience, visible: true, useSso: row.verified } });
        if (!r.ok) throw new Error();
        await qc.invalidateQueries({ queryKey: ["my-integrations"] });
      }
      toast.success(`${label} staat op je profiel`);
      close();
    } catch {
      toast.error("Toevoegen mislukt");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{vault ? "Integratiekluis" : "Component toevoegen"}</DialogTitle>
          </DialogHeader>
          {vault ? (
            <div className="space-y-4">
              <button type="button" onClick={() => setVault(null)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Terug naar de catalogus
              </button>
              <IntegrationVault focus={vault === "all" ? undefined : vault} />
              {vault === "all" && handle && <SocialVerifyPanel handle={handle} />}
            </div>
          ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">⚡ Live Status &amp; Feeds</h3>
                <button type="button" onClick={() => setVault("all")} className="text-xs font-medium underline underline-offset-2">
                  Alle koppelingen beheren
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {LIVE_COMPONENTS.map(({ provider, note }) => {
                  const item = integrationById(provider);
                  if (!item) return null;
                  const row = rowFor(provider);
                  const linked = provider === "spotify" ? Boolean(spotify) : Boolean(row);
                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => void pickLive(provider)}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
                    >
                      <BrandIcon icon={item.icon} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-sm font-medium">
                          {item.label}
                          {row?.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="Geverifieerd" />}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {linked ? `Gekoppeld · ${provider === "spotify" ? spotify?.accountName ?? "account" : "@" + row!.handle.replace(/^@/, "")}` : `${note} · nog koppelen`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            {COMPONENT_LIBRARY.map((group) => (
              <section key={group.id} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.items
                    .filter((item) => item.kind === "video" || BLOCK_KINDS.some((k) => k.kind === item.kind))
                    .map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => {
                          close();
                          if (item.kind === "video") setVideoOpen(true);
                          else onAdd(item.kind);
                        }}
                        className="rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {item.label}
                          {item.isNew && (
                            <span className="rounded-full bg-muted px-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Nieuw
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">{item.note}</span>
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
          )}
        </DialogContent>
      </Dialog>
      <VideoBlockDialog
        open={videoOpen}
        onClose={() => setVideoOpen(false)}
        onAdd={(url) => onAdd("media_embed", url)}
        onPro={() => setProOpen(true)}
      />
      <ProUpgradeModal open={proOpen} onClose={() => setProOpen(false)} />
    </>
  );
}
