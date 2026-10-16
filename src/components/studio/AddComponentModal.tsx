import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Search } from "lucide-react";
import { BrandIcon } from "@/components/integrations/BrandIcon";
import { integrationById } from "@/lib/integrations-catalog";
import { getMyIntegrations, saveIntegration } from "@/lib/integrations.functions";
import { getMyPresence, setSpotifyPresenceVisible } from "@/lib/presence.functions";
import { IntegrationVault } from "./IntegrationVault";
import { SocialVerifyPanel } from "@/components/dashboard/SocialVerifyPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isProfileSectionKind } from "@/lib/profile-section-blocks";
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
      { kind: "link", label: "Eigen link", note: "Elke webpagina" },
      { kind: "instagram", label: "Socials icoon-rij", note: "Instagram, TikTok, X, LinkedIn, …" },
      { kind: "text", label: "Tekst / Tussenkop", note: "Intro, kop of aankondiging", isNew: true },
      { kind: "spacer", label: "Scheidingslijn / Spacer", note: "Rust tussen secties", isNew: true },
      { kind: "vcard", label: "vCard contactkaart", note: "Eén tik → in de contacten" },
    ],
  },
  {
    id: "media",
    title: "🎬 Media",
    items: [
      { kind: "video", label: "Video embed", note: "YouTube, Vimeo of TikTok", isNew: true },
      { kind: "media_gallery", label: "Afbeelding / Galerij", note: "Foto's in een raster", isNew: true },
      { kind: "spotify", label: "Spotify / Audio embed", note: "Track, album of podcast", isNew: true },
      { kind: "soundcloud", label: "SoundCloud embed", note: "Track of profiel" },
    ],
  },
  {
    id: "leads",
    title: "💬 Interactief & Widgets",
    items: [
      { kind: "newsletter", label: "Nieuwsbrief", note: "Laat bezoekers inschrijven", isNew: true },
      { kind: "contact_form", label: "Contactformulier", note: "Direct bericht", isNew: true },
      { kind: "live_poll", label: "Live Poll", note: "Stel je volgers een vraag" },
      { kind: "widget:questions", label: "Anonieme Vragenbox", note: "Laat bezoekers anoniem vragen stellen" },
      { kind: "widget:guestbook", label: "Prikbord / Guestbook", note: "Berichten van leden" },
      { kind: "widget:badges", label: "ROUT Badges", note: "Je verdiende badges" },
      { kind: "widget:reach", label: "Totaal Bereik", note: "Je volgers over alle accounts" },
    ],
  },
  {
    id: "business",
    title: "💼 Zakelijk & Web3",
    items: [
      { kind: "calendly", label: "Calendly-boeking", note: "Laat mensen een moment kiezen", isNew: true },
      { kind: "booking_request", label: "Boekingsaanvraag", note: "Eigen tijdslots" },
      { kind: "matrix", label: "Matrix chat", note: "Soeverein chatten" },
      { kind: "vault:lightning", label: "Bitcoin Lightning", note: "Ontvang sats" },
      { kind: "vault:monero", label: "Monero", note: "Publiek XMR-adres" },
      { kind: "vault:ethereum", label: "Ethereum", note: "Publiek 0x-adres" },
    ],
  },
];

export type WidgetId = "questions" | "guestbook" | "badges" | "reach";

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
  /** Zet een profielwidget (vragenbox, badges, …) aan. */
  onWidget?: (id: WidgetId) => void;
}

/** De Component-bibliotheek: alles wat je aan je pagina kunt toevoegen. */
export function AddComponentModal({ open, onClose, onAdd, handle, onWidget }: Props) {
  const [tab, setTab] = useState<string>("live");
  const [query, setQuery] = useState("");
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
    setQuery("");
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

  const q = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(q);
  const available = (item: LibraryItem) =>
    item.kind === "video" || item.kind.includes(":") || BLOCK_KINDS.some((k) => k.kind === item.kind);
  const liveMatches = LIVE_COMPONENTS.filter(({ provider, note }) =>
    !q || matches(integrationById(provider)?.label ?? provider) || matches(note));
  const groupMatches = COMPONENT_LIBRARY
    .filter((g) => q || tab === g.id)
    .map((g) => ({ ...g, items: g.items.filter((i) => available(i) && (!q || matches(i.label) || matches(i.note))) }))
    .filter((g) => g.items.length > 0);

  const pickItem = (item: LibraryItem) => {
    if (item.kind.startsWith("vault:")) return setVault(item.kind.slice(6));
    close();
    if (isProfileSectionKind(item.kind)) { onAdd(item.kind); return; }
    if (item.kind.startsWith("widget:")) {
      const id = item.kind.slice(7) as WidgetId;
      if (onWidget) onWidget(id);
      else toast.info(`${item.label} beheer je verderop in de Studio`);
      return;
    }
    if (item.kind === "video") setVideoOpen(true);
    else onAdd(item.kind);
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
          <div className="space-y-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek componenten, live kaarten en widgets…"
                aria-label="Zoek componenten"
                className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            {!q && (
              <div role="tablist" aria-label="Categorieën" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {[{ id: "live", title: "⚡ Live Status & Feeds" }, ...COMPONENT_LIBRARY].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${tab === t.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
            {(q || tab === "live") && liveMatches.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">⚡ Live Status &amp; Feeds</h3>
                <button type="button" onClick={() => setVault("all")} className="text-xs font-medium underline underline-offset-2">
                  Alle koppelingen beheren
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {liveMatches.map(({ provider, note }) => {
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
            )}
            {groupMatches.map((group) => (
              <section key={group.id} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.items.map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => pickItem(item)}
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
            {q && liveMatches.length === 0 && groupMatches.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Geen componenten gevonden.</p>
            )}
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
