"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { History, ImageIcon, Minus, Newspaper, Plus, RotateCcw, ShieldCheck, Users, X } from "lucide-react";

export interface CompanyImageCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface CompanyMemberPreview {
  memberId: string | null;
  codeName: string;
  displayName: string;
  fullName: string | null;
  role: string | null;
  status: string;
  projectCount: number;
  joinedOn: string | null;
  effort: number | null;
  bio: string | null;
  joinContext: string | null;
  originLabel: string | null;
  residenceLabel: string | null;
  offTimeNote: string | null;
  favoriteFood: string | null;
  bucketList: string | null;
  mbtiTags: string[];
  imageUrl: string | null;
  photoAssetId: string | null;
  photoCrop: CompanyImageCrop;
  lastLoginAt: string | null;
}

export interface CompanyPhotoAssetPreview {
  assetId: string;
  title: string;
  imageUrl: string | null;
  kind: string;
  capturedAt: string | null;
  isCover: boolean;
  coverPosition?: string;
  crop: CompanyImageCrop;
}

export interface CompanyHistoryPreview {
  id: string;
  projectId: string | null;
  occurredOn: string | null;
  title: string;
  kind: string | null;
}

export interface CompanyPhotoPreview {
  id: string;
  title: string;
  meta: string;
  status: "unknown" | "internal_ok" | "public_ok";
  imageUrl: string | null;
  kind: string;
  itemCount?: number;
  occurredOn?: string | null;
  coverAssetId?: string | null;
  coverPosition?: string;
  crop?: CompanyImageCrop;
  assets?: CompanyPhotoAssetPreview[];
}

export interface CompanyMediaMentionPreview {
  id: string;
  projectId: string;
  projectName: string;
  occurredOn: string;
  title: string;
  mediaName: string;
  kind: string;
  sourceUrl: string | null;
}

interface Props {
  members: CompanyMemberPreview[];
  history: CompanyHistoryPreview[];
  photos: CompanyPhotoPreview[];
  mediaMentions: CompanyMediaMentionPreview[];
}

export function CompanyContentShelf({ members, history, photos, mediaMentions }: Props) {
  const [memberItems, setMemberItems] = useState(members);
  const [selectedMember, setSelectedMember] = useState<CompanyMemberPreview | null>(null);
  const [photoItems, setPhotoItems] = useState(photos);
  const [selectedPhoto, setSelectedPhoto] = useState<CompanyPhotoPreview | null>(null);
  const [savingCoverAssetId, setSavingCoverAssetId] = useState<string | null>(null);
  const [savingMemberPhotoAssetId, setSavingMemberPhotoAssetId] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [memberPhotoError, setMemberPhotoError] = useState<string | null>(null);

  useEffect(() => setMemberItems(members), [members]);
  useEffect(() => setPhotoItems(photos), [photos]);

  async function selectPhotoCover(photo: CompanyPhotoPreview, asset: CompanyPhotoAssetPreview, crop = asset.crop || photo.crop || DEFAULT_CROP) {
    const nextCrop = clampCrop(crop);
    setCoverError(null);
    setSavingCoverAssetId(asset.assetId);
    try {
      const response = await fetch("/api/admin/company-media/group-cover", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: asset.assetId, crop: nextCrop }),
      });
      if (!response.ok) throw new Error("cover update failed");

      const updatePhoto = (item: CompanyPhotoPreview): CompanyPhotoPreview => {
        if (item.id !== photo.id) return item;
        return {
          ...item,
          coverAssetId: asset.assetId,
          imageUrl: asset.imageUrl,
          kind: asset.kind,
          crop: nextCrop,
          assets: (item.assets ?? []).map((row) => ({
            ...row,
            isCover: row.assetId === asset.assetId,
            crop: row.assetId === asset.assetId ? nextCrop : row.crop,
          })),
        };
      };
      setPhotoItems((items) => items.map(updatePhoto));
      setSelectedPhoto((current) => current ? updatePhoto(current) : current);
    } catch {
      setCoverError("サムネ変更に失敗した");
    } finally {
      setSavingCoverAssetId(null);
    }
  }

  async function saveMemberPhotoCrop(member: CompanyMemberPreview, crop: CompanyImageCrop) {
    if (!member.photoAssetId) return;
    const nextCrop = clampCrop(crop);
    setMemberPhotoError(null);
    setSavingMemberPhotoAssetId(member.photoAssetId);
    try {
      const response = await fetch("/api/admin/company-media/asset-crop", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: member.photoAssetId, crop: nextCrop }),
      });
      if (!response.ok) throw new Error("member photo crop update failed");

      const updateMember = (item: CompanyMemberPreview): CompanyMemberPreview => (
        item.photoAssetId === member.photoAssetId ? { ...item, photoCrop: nextCrop } : item
      );
      setMemberItems((items) => items.map(updateMember));
      setSelectedMember((current) => current ? updateMember(current) : current);
    } catch {
      setMemberPhotoError("写真位置の保存に失敗した");
    } finally {
      setSavingMemberPhotoAssetId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Company Content
          </p>
          <h2 className="text-base font-semibold text-foreground">Team / History / Media / Photo</h2>
        </div>
        <span className="hidden rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
          Admin draft
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <ShelfColumn
          icon={<Users className="h-4 w-4" />}
          title="メンバー"
          countLabel={`${memberItems.length} active`}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {memberItems.map((member) => {
              return (
                <button
                  key={member.memberId ?? `unresolved-${member.codeName}`}
                  type="button"
                  onClick={() => setSelectedMember(member)}
                  className="group grid h-[150px] grid-rows-[112px_38px] overflow-hidden rounded-md border border-border/70 bg-white text-left transition-colors hover:bg-muted/30"
                >
                  <span className="grid h-[112px] w-full place-items-center overflow-hidden bg-sky-50 text-sm font-semibold text-sky-800">
                    {member.imageUrl ? (
                      <MediaPreview src={member.imageUrl} kind="photo" crop={member.photoCrop} />
                    ) : (
                      <Users className="h-5 w-5 text-sky-700/55" />
                    )}
                  </span>
                  <span className="block min-w-0 px-2 py-2">
                    <span className="block truncate text-center text-sm font-semibold text-foreground">{member.codeName}</span>
                  </span>
                </button>
              );
            })}
            {memberItems.length === 0 && (
              <EmptyLine text="active member profile はまだ読み込めていません" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<History className="h-4 w-4" />}
          title="沿革"
          countLabel={`${history.length} events`}
        >
          <div className="space-y-2">
            {history.map((event) => (
              <div key={event.id} className="rounded-md border border-border/70 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {event.occurredOn ? event.occurredOn.replaceAll("-", ".") : "date tbd"}
                  </span>
                  {event.projectId && (
                    <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {event.projectId}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">{event.title}</p>
                {event.kind && <p className="mt-1 text-[11px] text-muted-foreground">{event.kind}</p>}
              </div>
            ))}
            {history.length === 0 && (
              <EmptyLine text="history は Notion 移植レビュー後に増やします" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<Newspaper className="h-4 w-4" />}
          title="メディア掲載"
          countLabel={`${mediaMentions.length} items`}
        >
          <div className="space-y-2">
            {mediaMentions.map((item) => (
              <div key={item.id} className="rounded-md border border-border/70 bg-white px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                    {item.projectName}
                  </span>
                  <KindBadge kind={item.kind} />
                  <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                    {item.occurredOn.replaceAll("-", ".")}
                  </span>
                </div>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 line-clamp-2 block text-sm font-medium leading-snug text-foreground hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">{item.title}</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">{item.mediaName}</p>
              </div>
            ))}
            {mediaMentions.length === 0 && (
              <EmptyLine text="メディア掲載記録はまだありません" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<ImageIcon className="h-4 w-4" />}
          title="photo"
          countLabel={`${photos.length} groups`}
        >
          <div className="space-y-2">
            {photoItems.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  setCoverError(null);
                  setSelectedPhoto(photo);
                }}
                className="block w-full overflow-hidden rounded-md border border-border/70 bg-white text-left transition-colors hover:bg-muted/30"
              >
                <div className="relative flex h-24 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f8fafc,#eef6ff_48%,#f7f3ea)]">
                  {photo.imageUrl ? (
                    <MediaPreview src={photo.imageUrl} kind={photo.kind} crop={photo.crop} objectPosition={photo.coverPosition} />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-slate-500/70" />
                  )}
                </div>
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{photo.title}</p>
                    <PermissionBadge status={photo.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {[photo.itemCount ? `${photo.itemCount} items` : null, photo.occurredOn, photo.kind, photo.meta].filter(Boolean).join(" / ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ShelfColumn>
      </div>

      {selectedMember && (
        <Modal title={selectedMember.codeName} onClose={() => setSelectedMember(null)}>
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-sky-50 text-xl font-semibold text-sky-800">
              {selectedMember.imageUrl ? (
                <MediaPreview src={selectedMember.imageUrl} kind="photo" crop={selectedMember.photoCrop} />
              ) : (
                initials(selectedMember.codeName)
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-lg font-semibold text-foreground">{selectedMember.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {[selectedMember.fullName, selectedMember.role || selectedMember.status].filter(Boolean).join(" / ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    selectedMember.lastLoginAt ? `last login ${formatDateTime(selectedMember.lastLoginAt)}` : "last login unknown",
                    selectedMember.joinedOn ? `joined ${selectedMember.joinedOn}` : null,
                    selectedMember.effort == null ? null : `effort ${Math.round(selectedMember.effort * 100)}%`,
                  ].filter(Boolean).join(" / ")}
                </p>
              </div>
              {selectedMember.bio && <p className="text-sm leading-6 text-muted-foreground">{selectedMember.bio}</p>}
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <DetailLine label="参画" value={selectedMember.joinContext} />
            <DetailLine label="拠点" value={[selectedMember.originLabel, selectedMember.residenceLabel].filter(Boolean).join(" / ") || null} />
            <DetailLine label="オフ" value={selectedMember.offTimeNote} />
            <DetailLine label="好きな食べ物" value={selectedMember.favoriteFood} />
            <DetailLine label="バケットリスト" value={selectedMember.bucketList} />
            <DetailLine label="タグ" value={selectedMember.mbtiTags.join(" / ") || null} />
          </div>

          {selectedMember.imageUrl && selectedMember.photoAssetId && (
            <div className="mt-4 rounded-md border border-border bg-white p-3">
              <CropEditor
                title="メンバー写真の表示位置"
                src={selectedMember.imageUrl}
                kind="photo"
                aspect="square"
                value={selectedMember.photoCrop}
                saving={savingMemberPhotoAssetId === selectedMember.photoAssetId}
                onSave={(crop) => saveMemberPhotoCrop(selectedMember, crop)}
              />
              {memberPhotoError && <p className="mt-2 text-xs text-red-600">{memberPhotoError}</p>}
            </div>
          )}
        </Modal>
      )}

      {selectedPhoto && (
        <Modal title={selectedPhoto.title} onClose={() => setSelectedPhoto(null)}>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border border-border bg-muted">
              <div className="grid aspect-video place-items-center overflow-hidden">
                {selectedPhoto.imageUrl ? (
                  <MediaPreview src={selectedPhoto.imageUrl} kind={selectedPhoto.kind} crop={selectedPhoto.crop} objectPosition={selectedPhoto.coverPosition} />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 text-xs text-muted-foreground">
                <PermissionBadge status={selectedPhoto.status} />
                <span>{[selectedPhoto.itemCount ? `${selectedPhoto.itemCount} items` : null, selectedPhoto.occurredOn, selectedPhoto.meta].filter(Boolean).join(" / ")}</span>
              </div>
            </div>

            {selectedPhoto.coverAssetId && selectedPhoto.imageUrl && (
              <div className="rounded-md border border-border bg-white p-3">
                <CropEditor
                  title="サムネ表示位置"
                  src={selectedPhoto.imageUrl}
                  kind={selectedPhoto.kind}
                  aspect="video"
                  value={selectedPhoto.crop ?? DEFAULT_CROP}
                  saving={savingCoverAssetId === selectedPhoto.coverAssetId}
                  onSave={(crop) => {
                    const currentCover = selectedPhoto.assets?.find((asset) => asset.assetId === selectedPhoto.coverAssetId);
                    if (currentCover) selectPhotoCover(selectedPhoto, currentCover, crop);
                  }}
                />
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              {(selectedPhoto.assets ?? []).map((asset) => (
                <div key={asset.assetId} className="overflow-hidden rounded-md border border-border bg-white">
                  <div className="grid aspect-video place-items-center overflow-hidden bg-muted">
                    {asset.imageUrl ? (
                      <MediaPreview src={asset.imageUrl} kind={asset.kind} crop={asset.crop} objectPosition={asset.coverPosition} />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2 p-2">
                    <p className="line-clamp-2 text-xs font-medium text-foreground">{asset.title}</p>
                    <button
                      type="button"
                      onClick={() => selectPhotoCover(selectedPhoto, asset)}
                      disabled={asset.isCover || savingCoverAssetId === asset.assetId || !asset.imageUrl}
                      className="w-full rounded border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
                    >
                      {asset.isCover ? "サムネ中" : savingCoverAssetId === asset.assetId ? "変更中" : "サムネにする"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {coverError && <p className="text-xs text-red-600">{coverError}</p>}
            {(selectedPhoto.assets ?? []).length === 0 && <EmptyLine text="このグループの画像一覧を読み込めていません" />}
          </div>
        </Modal>
      )}
    </section>
  );
}

const DEFAULT_CROP: CompanyImageCrop = { x: 0, y: 0, zoom: 1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const MIN_OFFSET = -100;
const MAX_OFFSET = 100;

function CropEditor({
  title,
  src,
  kind,
  aspect,
  value,
  saving,
  onSave,
}: {
  title: string;
  src: string;
  kind: string;
  aspect: "video" | "square";
  value: CompanyImageCrop;
  saving: boolean;
  onSave: (crop: CompanyImageCrop) => void;
}) {
  const [draft, setDraft] = useState(() => clampCrop(value));
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; crop: CompanyImageCrop } | null>(null);

  useEffect(() => {
    setDraft(clampCrop(value));
  }, [value.x, value.y, value.zoom]);

  function updateDraft(patch: Partial<CompanyImageCrop>) {
    setDraft((current) => clampCrop({ ...current, ...patch }));
  }

  function nudgeZoom(delta: number) {
    updateDraft({ zoom: draft.zoom + delta });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop: draft,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = rect.width > 0 ? ((event.clientX - drag.startX) / rect.width) * 100 : 0;
    const dy = rect.height > 0 ? ((event.clientY - drag.startY) / rect.height) * 100 : 0;
    setDraft(clampCrop({ ...drag.crop, x: drag.crop.x + dx, y: drag.crop.y + dy }));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">{title}</p>
        <span className="font-mono text-[10px] text-muted-foreground">
          x {Math.round(draft.x)} / y {Math.round(draft.y)} / {draft.zoom.toFixed(2)}x
        </span>
      </div>
      <div
        className={`touch-none cursor-grab overflow-hidden rounded-md border border-border bg-muted active:cursor-grabbing ${aspect === "square" ? "aspect-square" : "aspect-video"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <MediaPreview src={src} kind={kind} crop={draft} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <button
          type="button"
          onClick={() => nudgeZoom(-0.1)}
          className="inline-flex h-8 items-center justify-center gap-1 rounded border border-border bg-muted/30 px-2 text-xs font-medium text-foreground hover:bg-muted/50"
        >
          <Minus className="h-3.5 w-3.5" />
          zoom
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step="0.01"
          value={draft.zoom}
          onChange={(event) => updateDraft({ zoom: Number(event.target.value) })}
          className="w-full"
          aria-label="zoom"
        />
        <button
          type="button"
          onClick={() => nudgeZoom(0.1)}
          className="inline-flex h-8 items-center justify-center gap-1 rounded border border-border bg-muted/30 px-2 text-xs font-medium text-foreground hover:bg-muted/50"
        >
          <Plus className="h-3.5 w-3.5" />
          zoom
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
          横位置
          <input
            type="range"
            min={MIN_OFFSET}
            max={MAX_OFFSET}
            step="1"
            value={draft.x}
            onChange={(event) => updateDraft({ x: Number(event.target.value) })}
            className="w-full"
          />
        </label>
        <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
          縦位置
          <input
            type="range"
            min={MIN_OFFSET}
            max={MAX_OFFSET}
            step="1"
            value={draft.y}
            onChange={(event) => updateDraft({ y: Number(event.target.value) })}
            className="w-full"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDraft(DEFAULT_CROP)}
          className="inline-flex h-8 items-center gap-1 rounded border border-border bg-white px-2 text-xs font-medium text-muted-foreground hover:bg-muted/30"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          reset
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={saving}
          className="ml-auto h-8 rounded border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          {saving ? "保存中" : "位置を保存"}
        </button>
      </div>
    </div>
  );
}

function MediaPreview({ src, kind, objectPosition, crop }: { src: string; kind: string; objectPosition?: string; crop?: CompanyImageCrop }) {
  const nextCrop = crop ? clampCrop(crop) : null;
  const style = nextCrop
    ? {
        transform: `translate(-50%, -50%) translate(${nextCrop.x}%, ${nextCrop.y}%) scale(${nextCrop.zoom})`,
        transformOrigin: "center",
      }
    : { objectPosition: objectPositionCss(objectPosition) };
  const className = nextCrop
    ? "absolute left-1/2 top-1/2 h-full w-full object-cover"
    : "h-full w-full object-cover";
  const body = kind === "video" ? (
    <video
      src={src}
      className={className}
      style={style}
      muted
      playsInline
      preload="metadata"
    />
  ) : (
    <img src={src} alt="" className={className} style={style} loading="lazy" />
  );
  if (nextCrop) {
    return <span className="relative block h-full w-full overflow-hidden">{body}</span>;
  }
  if (kind === "video") {
    return (
      <video
        src={src}
        className={className}
        style={style}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return <img src={src} alt="" className={className} style={style} loading="lazy" />;
}

function objectPositionCss(value?: string) {
  const map: Record<string, string> = {
    "top-left": "left top",
    top: "center top",
    "top-right": "right top",
    left: "left center",
    center: "center center",
    right: "right center",
    "bottom-left": "left bottom",
    bottom: "center bottom",
    "bottom-right": "right bottom",
  };
  return map[value || "center"] ?? "center center";
}

function clampCrop(value: Partial<CompanyImageCrop> | null | undefined): CompanyImageCrop {
  return {
    x: clampNumber(value?.x, MIN_OFFSET, MAX_OFFSET, DEFAULT_CROP.x),
    y: clampNumber(value?.y, MIN_OFFSET, MAX_OFFSET, DEFAULT_CROP.y),
    zoom: clampNumber(value?.zoom, MIN_ZOOM, MAX_ZOOM, DEFAULT_CROP.zoom),
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function ShelfColumn({
  icon,
  title,
  countLabel,
  children,
}: {
  icon: ReactNode;
  title: string;
  countLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto rounded border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
          {countLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    coverage:      { label: "掲載",       cls: "border-sky-200 bg-sky-50 text-sky-700" },
    press_release: { label: "PR",         cls: "border-violet-200 bg-violet-50 text-violet-700" },
    funding:       { label: "資金調達",   cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    award:         { label: "受賞",       cls: "border-amber-200 bg-amber-50 text-amber-700" },
    pitch:         { label: "登壇",       cls: "border-orange-200 bg-orange-50 text-orange-700" },
    own_news:      { label: "自社News",   cls: "border-slate-200 bg-slate-50 text-slate-600" },
  };
  const { label, cls } = map[kind] ?? { label: kind, cls: "border-border bg-muted/30 text-muted-foreground" };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${cls}`}>{label}</span>
  );
}

function PermissionBadge({ status }: { status: CompanyPhotoPreview["status"] }) {
  if (status === "public_ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
        <ShieldCheck className="h-3 w-3" />
        public
      </span>
    );
  }
  if (status === "internal_ok") {
    return (
      <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
        internal
      </span>
    );
  }
  return (
    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      review
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-white px-3 py-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-foreground">{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-white text-muted-foreground hover:bg-muted/40"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

function initials(value: string) {
  const ascii = value.match(/[A-Za-z0-9]+/g)?.join("");
  if (ascii) return ascii.slice(0, 2).toUpperCase();
  return value.slice(0, 2);
}
