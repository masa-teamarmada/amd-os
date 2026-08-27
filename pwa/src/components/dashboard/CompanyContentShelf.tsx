"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useModalContainment } from "@/components/project-workspace/useModalContainment";
import { ArrowRight, ChevronDown, ChevronUp, History, ImageIcon, Minus, Newspaper, Plus, RotateCcw, ShieldCheck, Upload, Users, X } from "lucide-react";
import type {
  CompanyHistoryPreview,
  CompanyImageCrop,
  CompanyMediaMentionPreview,
  CompanyMemberPreview,
  CompanyPhotoAssetPreview,
  CompanyPhotoPreview,
} from "@/types/company-content";

export type {
  CompanyImageCrop,
  CompanyMemberPreview,
  CompanyPhotoAssetPreview,
  CompanyHistoryPreview,
  CompanyPhotoPreview,
  CompanyMediaMentionPreview,
  CompanyContentPreview,
} from "@/types/company-content";

/** 写真は最新のできごとが一目で分かればよいので、既定は直近だけ出す。 */
const PHOTO_PREVIEW_COUNT = 12;
/** 沿革・メディア掲載は数百件あるので、既定は直近だけ出して全件は展開に回す。 */
const LIST_PREVIEW_COUNT = 20;

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
  const [uploadingMemberKey, setUploadingMemberKey] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [memberPhotoError, setMemberPhotoError] = useState<string | null>(null);
  const [memberUploadError, setMemberUploadError] = useState<string | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllMentions, setShowAllMentions] = useState(false);

  useEffect(() => setMemberItems(members), [members]);
  useEffect(() => setPhotoItems(photos), [photos]);

  async function selectPhotoCover(photo: CompanyPhotoPreview, asset: CompanyPhotoAssetPreview, crop = asset.crop || photo.crop || DEFAULT_CROP) {
    const nextCrop = clampCropForZoom(crop);
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
    const nextCrop = clampCropForZoom(crop);
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

  async function uploadMemberPhoto(member: CompanyMemberPreview, file: File) {
    if (!member.memberProfileId || !member.memberId) {
      setMemberUploadError("member profile が見つからない");
      return;
    }

    const memberKey = member.memberProfileId;
    setMemberUploadError(null);
    setUploadingMemberKey(memberKey);
    try {
      const formData = new FormData();
      formData.append("memberProfileId", member.memberProfileId);
      formData.append("memberId", member.memberId);
      formData.append("codeName", member.codeName);
      formData.append("file", file);

      const response = await fetch("/api/admin/company-members/photo", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("member photo upload failed");
      const result = await response.json() as { assetId: string; imageUrl: string; crop: CompanyImageCrop };
      const nextCrop = clampCrop(result.crop);
      const updateMember = (item: CompanyMemberPreview): CompanyMemberPreview => (
        item.memberProfileId === member.memberProfileId
          ? { ...item, photoAssetId: result.assetId, imageUrl: result.imageUrl, photoCrop: nextCrop }
          : item
      );
      setMemberItems((items) => items.map(updateMember));
      setSelectedMember((current) => current ? updateMember(current) : current);
    } catch {
      setMemberUploadError("写真アップロードに失敗した");
    } finally {
      setUploadingMemberKey(null);
    }
  }

  const visiblePhotos = showAllPhotos ? photoItems : photoItems.slice(0, PHOTO_PREVIEW_COUNT);
  const visibleHistory = showAllHistory ? history : history.slice(0, LIST_PREVIEW_COUNT);
  const visibleMentions = showAllMentions ? mediaMentions : mediaMentions.slice(0, LIST_PREVIEW_COUNT);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
            会社の記録
          </p>
          <h2 className="text-base font-semibold text-foreground">メンバー・沿革・メディア掲載・写真</h2>
        </div>
        <Link
          href="/company"
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-medium text-[var(--desk-blue)] hover:bg-muted/40"
        >
          会社情報をまとめて見る
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* 写真は「最近あったこと」が一目で分かる唯一の面なので、他の列と横並びにせず先頭へ全幅で置く。
          旧4カラムでは右端に押し込まれ、右カラム (マイページ) に覆われて読めなかった。 */}
      <ShelfColumn
        icon={<ImageIcon className="h-4 w-4" />}
        title="写真"
        countLabel={`${photoItems.length}件`}
        action={photoItems.length > PHOTO_PREVIEW_COUNT ? (
          <ShelfMoreButton
            expanded={showAllPhotos}
            onClick={() => setShowAllPhotos((value) => !value)}
          />
        ) : null}
      >
        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 ${showAllPhotos ? "max-h-[360px] overflow-y-auto pr-1 lg:max-h-[520px]" : ""}`}>
          {visiblePhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => {
                setCoverError(null);
                setSelectedPhoto(photo);
              }}
              className="block w-full overflow-hidden rounded-md border border-border/70 bg-white text-left transition-colors hover:bg-muted/30"
            >
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f8fafc,#eef6ff_48%,#f7f3ea)]">
                {photo.imageUrl ? (
                  <MediaPreview src={withFileVariant(photo.imageUrl, "thumb")} kind={photo.kind} crop={photo.crop} objectPosition={photo.coverPosition} />
                ) : (
                  <ImageIcon className="h-5 w-5 text-slate-500/70" />
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate text-[13px] font-medium leading-tight text-foreground">{photo.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[formatDayLabel(photo.occurredOn), photo.itemCount ? `${photo.itemCount}枚` : null].filter(Boolean).join(" / ")}
                </p>
              </div>
            </button>
          ))}
          {photoItems.length === 0 && <EmptyLine text="まだ登録がありません" />}
        </div>
      </ShelfColumn>

      {/* メンバー / 沿革 / メディア掲載は件数が大きく違うので、3列とも同じ高さで内部スクロールさせる。
          高さを揃えないと、一番長い列にあわせて他の列の下に数千pxの空白が出る。 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ShelfColumn
          icon={<Users className="h-4 w-4" />}
          title="メンバー"
          countLabel={`${memberItems.length}人`}
        >
          {/* 4列にすると9人が420px以内に3行で収まり、スクロールせずに全員が見える。 */}
          <div className="grid max-h-[320px] lg:max-h-[420px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
            {memberItems.map((member) => {
              return (
                <button
                  key={member.memberId ?? `unresolved-${member.codeName}`}
                  type="button"
                  onClick={() => setSelectedMember(member)}
                  className="group grid overflow-hidden rounded-md border border-border/70 bg-white text-left transition-colors hover:bg-muted/30"
                >
                  <span className="grid aspect-square w-full place-items-center overflow-hidden bg-sky-50 text-sm font-semibold text-sky-800">
                    {member.imageUrl ? (
                      <MediaPreview src={withFileVariant(member.imageUrl, "thumb")} kind="photo" crop={member.photoCrop} />
                    ) : (
                      <Users className="h-5 w-5 text-sky-700/55" />
                    )}
                  </span>
                  <span className="block min-w-0 px-2 py-1.5">
                    <span className="block truncate text-center text-[13px] font-semibold text-foreground">{member.codeName}</span>
                  </span>
                </button>
              );
            })}
            {memberItems.length === 0 && (
              <EmptyLine text="まだ登録がありません" />
            )}
          </div>
        </ShelfColumn>

        <ShelfColumn
          icon={<History className="h-4 w-4" />}
          title="沿革"
          countLabel={`${history.length}件`}
          action={history.length > LIST_PREVIEW_COUNT ? (
            <ShelfMoreButton
              expanded={showAllHistory}
              onClick={() => setShowAllHistory((value) => !value)}
            />
          ) : null}
        >
          <ul className="max-h-[320px] lg:max-h-[420px] divide-y divide-border/60 overflow-y-auto pr-1">
            {visibleHistory.map((event) => (
              <li key={event.id} className="flex items-baseline gap-2 py-1.5">
                <span className="w-[68px] shrink-0 font-mono text-[11px] text-muted-foreground">
                  {event.occurredOn ? event.occurredOn.replaceAll("-", ".") : "日付未定"}
                </span>
                {event.projectId && (
                  <span className="shrink-0 rounded border border-border bg-muted/30 px-1 py-px font-mono text-[10px] text-muted-foreground">
                    {event.projectId}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground" title={event.title}>
                  {event.title}
                </span>
              </li>
            ))}
            {history.length === 0 && (
              <EmptyLine text="まだ登録がありません" />
            )}
          </ul>
        </ShelfColumn>

        <ShelfColumn
          icon={<Newspaper className="h-4 w-4" />}
          title="メディア掲載"
          countLabel={`${mediaMentions.length}件`}
          action={mediaMentions.length > LIST_PREVIEW_COUNT ? (
            <ShelfMoreButton
              expanded={showAllMentions}
              onClick={() => setShowAllMentions((value) => !value)}
            />
          ) : null}
        >
          <ul className="max-h-[320px] lg:max-h-[420px] divide-y divide-border/60 overflow-y-auto pr-1">
            {visibleMentions.map((item) => (
              <li key={item.id} className="py-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="w-[68px] shrink-0 font-mono text-[11px] text-muted-foreground">
                    {item.occurredOn.replaceAll("-", ".")}
                  </span>
                  <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1 py-px text-[10px] font-semibold text-slate-600">
                    {item.projectName}
                  </span>
                  <KindBadge kind={item.kind} />
                </div>
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-[13px] leading-snug text-foreground hover:underline"
                    title={`${item.title} — ${item.mediaName}`}
                  >
                    {item.title}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">{item.mediaName}</span>
                  </a>
                ) : (
                  <p className="mt-0.5 truncate text-[13px] leading-snug text-foreground" title={`${item.title} — ${item.mediaName}`}>
                    {item.title}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">{item.mediaName}</span>
                  </p>
                )}
              </li>
            ))}
            {mediaMentions.length === 0 && (
              <EmptyLine text="まだ登録がありません" />
            )}
          </ul>
        </ShelfColumn>
      </div>

      {selectedMember && (
        <Modal title={selectedMember.codeName} onClose={() => setSelectedMember(null)}>
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-sky-50 text-xl font-semibold text-sky-800">
              {selectedMember.imageUrl ? (
                <MediaPreview src={withFileVariant(selectedMember.imageUrl, "original")} kind="photo" crop={selectedMember.photoCrop} eager />
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
                src={withFileVariant(selectedMember.imageUrl, "original")}
                kind="photo"
                aspect="square"
                value={selectedMember.photoCrop}
                saving={savingMemberPhotoAssetId === selectedMember.photoAssetId}
                onSave={(crop) => saveMemberPhotoCrop(selectedMember, crop)}
              />
              {memberPhotoError && <p className="mt-2 text-xs text-red-600">{memberPhotoError}</p>}
            </div>
          )}

          <div className="mt-4 rounded-md border border-border bg-white p-3">
            <MemberPhotoUploader
              member={selectedMember}
              uploading={uploadingMemberKey === selectedMember.memberProfileId}
              onUpload={(file) => uploadMemberPhoto(selectedMember, file)}
            />
            {memberUploadError && <p className="mt-2 text-xs text-red-600">{memberUploadError}</p>}
          </div>
        </Modal>
      )}

      {selectedPhoto && (
        <Modal title={selectedPhoto.title} onClose={() => setSelectedPhoto(null)}>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border border-border bg-muted">
              <div className="grid aspect-video place-items-center overflow-hidden">
                {selectedPhoto.imageUrl ? (
                  <MediaPreview src={withFileVariant(selectedPhoto.imageUrl, "original")} kind={selectedPhoto.kind} crop={selectedPhoto.crop} objectPosition={selectedPhoto.coverPosition} eager />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 text-xs text-muted-foreground">
                <PermissionBadge status={selectedPhoto.status} />
                <span>{[selectedPhoto.itemCount ? `${selectedPhoto.itemCount}枚` : null, formatDayLabel(selectedPhoto.occurredOn), selectedPhoto.meta].filter(Boolean).join(" / ")}</span>
              </div>
            </div>

            {selectedPhoto.coverAssetId && selectedPhoto.imageUrl && (
              <div className="rounded-md border border-border bg-white p-3">
                <CropEditor
                  title="サムネ表示位置"
                  src={withFileVariant(selectedPhoto.imageUrl, "original")}
                  kind={selectedPhoto.kind}
                  aspect="photo-card"
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
                      <MediaPreview src={withFileVariant(asset.imageUrl, "thumb")} kind={asset.kind} crop={asset.crop} objectPosition={asset.coverPosition} />
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
            {(selectedPhoto.assets ?? []).length === 0 && <EmptyLine text="この写真グループの一覧を読み込めていません" />}
          </div>
        </Modal>
      )}
    </section>
  );
}

const DEFAULT_CROP: CompanyImageCrop = { x: 0, y: 0, zoom: 1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

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
  aspect: "photo-card" | "video" | "square";
  value: CompanyImageCrop;
  saving: boolean;
  onSave: (crop: CompanyImageCrop) => void;
}) {
  const [draft, setDraft] = useState(() => clampCropForZoom(value));
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; crop: CompanyImageCrop } | null>(null);

  useEffect(() => {
    setDraft(clampCropForZoom(value));
  }, [value.x, value.y, value.zoom]);

  function updateDraft(patch: Partial<CompanyImageCrop>) {
    setDraft((current) => clampCropForZoom({ ...current, ...patch }));
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
    const rect = frameRef.current?.getBoundingClientRect();
    const dx = rect && rect.width > 0 ? ((event.clientX - drag.startX) / rect.width) * 100 : 0;
    const dy = rect && rect.height > 0 ? ((event.clientY - drag.startY) / rect.height) * 100 : 0;
    setDraft(clampCropForZoom({ ...drag.crop, x: drag.crop.x + dx, y: drag.crop.y + dy }));
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
        className="relative h-[360px] touch-none cursor-grab overflow-hidden rounded-md border border-border bg-slate-950 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={frameRef}
          className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-visible border-2 border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.52)] ${cropFrameClassName(aspect)}`}
        >
          <CropImageLayer src={src} kind={kind} crop={draft} eager clip={false} />
          <span className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/50" />
          <span className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/50" />
          <span className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/50" />
          <span className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/50" />
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded border border-white/25 bg-black/45 px-2 py-1 text-[10px] font-medium text-white">
          画像をドラッグして、枠に入る位置を合わせる
        </div>
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
        <CropRange label="横位置" value={draft.x} zoom={draft.zoom} onChange={(x) => updateDraft({ x })} />
        <CropRange label="縦位置" value={draft.y} zoom={draft.zoom} onChange={(y) => updateDraft({ y })} />
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

function CropRange({
  label,
  value,
  zoom,
  onChange,
}: {
  label: string;
  value: number;
  zoom: number;
  onChange: (value: number) => void;
}) {
  const limit = panLimitForZoom(zoom);
  return (
    <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
      {label}
      <input
        type="range"
        min={-limit}
        max={limit}
        step="0.5"
        value={clampNumber(value, -limit, limit, 0)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

function cropFrameClassName(aspect: "photo-card" | "video" | "square") {
  if (aspect === "square") return "h-[72%] aspect-square";
  if (aspect === "photo-card") return "w-[72%] aspect-[4/3]";
  return "w-[76%] aspect-video";
}

function MemberPhotoUploader({
  member,
  uploading,
  onUpload,
}: {
  member: CompanyMemberPreview;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const disabled = uploading || !member.memberProfileId || !member.memberId;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">メンバー写真を差し替え</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-8 items-center gap-1 rounded border border-border bg-muted/30 px-2 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "アップロード中" : "画像を選択"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <p className="text-[11px] leading-5 text-muted-foreground">
        選んだ画像は review 扱いで保存して、このメンバーの表示写真に切り替える。
      </p>
    </div>
  );
}

function MediaPreview({
  src,
  kind,
  objectPosition,
  crop,
  eager = false,
}: {
  src: string;
  kind: string;
  objectPosition?: string;
  crop?: CompanyImageCrop;
  eager?: boolean;
}) {
  const nextCrop = crop ? clampCrop(crop) : null;
  if (nextCrop) {
    return <CropImageLayer src={src} kind={kind} crop={nextCrop} eager={eager} clip />;
  }
  const style = { objectPosition: objectPositionCss(objectPosition) };
  const className = "h-full w-full object-cover";
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
  return (
    <img
      src={src}
      alt=""
      className={className}
      style={style}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
    />
  );
}

function CropImageLayer({
  src,
  kind,
  crop,
  eager = false,
  clip,
}: {
  src: string;
  kind: string;
  crop: CompanyImageCrop;
  eager?: boolean;
  clip: boolean;
}) {
  const nextCrop = clampCropForZoom(crop);
  const style = {
    transform: `translate(-50%, -50%) translate(${nextCrop.x}%, ${nextCrop.y}%) scale(${nextCrop.zoom})`,
    transformOrigin: "center",
  };
  const className = "absolute left-1/2 top-1/2 h-full w-full object-cover";
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
    <img
      src={src}
      alt=""
      className={className}
      style={style}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
    />
  );
  return <span className={`relative block h-full w-full ${clip ? "overflow-hidden" : "overflow-visible"}`}>{body}</span>;
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
    x: clampNumber(value?.x, -100, 100, DEFAULT_CROP.x),
    y: clampNumber(value?.y, -100, 100, DEFAULT_CROP.y),
    zoom: clampNumber(value?.zoom, MIN_ZOOM, MAX_ZOOM, DEFAULT_CROP.zoom),
  };
}

function clampCropForZoom(value: Partial<CompanyImageCrop> | null | undefined): CompanyImageCrop {
  const base = clampCrop(value);
  const limit = panLimitForZoom(base.zoom);
  return {
    ...base,
    x: clampNumber(base.x, -limit, limit, DEFAULT_CROP.x),
    y: clampNumber(base.y, -limit, limit, DEFAULT_CROP.y),
  };
}

function panLimitForZoom(zoom: number) {
  const nextZoom = clampNumber(zoom, MIN_ZOOM, MAX_ZOOM, DEFAULT_CROP.zoom);
  return Math.max(0, ((nextZoom - 1) / nextZoom) * 50);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function withFileVariant(src: string, variant: "thumb" | "original") {
  try {
    const url = new URL(src, "http://amd-os.local");
    url.searchParams.set("variant", variant);
    const value = `${url.pathname}${url.search}${url.hash}`;
    return src.startsWith("http") ? url.toString() : value;
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}variant=${variant}`;
  }
}

function ShelfColumn({
  icon,
  title,
  countLabel,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  countLabel: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
          {countLabel}
        </span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
}

/** 既定は直近だけ出し、押すと全件へ切り替える。総件数は見出しのバッジが持つので繰り返さない。 */
function ShelfMoreButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--desk-blue)] hover:bg-muted/40"
    >
      {expanded ? "直近だけ" : "全部見る"}
      {expanded ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
}

/** 2026.08.26 形式。日付が無い写真グループは日付欄ごと出さない。 */
function formatDayLabel(value?: string | null) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.replaceAll("-", ".") : text;
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
        社外可
      </span>
    );
  }
  if (status === "internal_ok") {
    return (
      <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
        社内のみ
      </span>
    );
  }
  return (
    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      未確認
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

/**
 * body 直下へ portal し、Escape・背景クリック・背面スクロール抑止・フォーカストラップを持たせる。
 * 旧実装は shelf の中にそのまま描いていたため、閉じる手段が右上の × だけで、
 * 開いている間も裏のホームがスクロールし続けていた。
 * z は ナビ(50) / ナビのフライアウト(60,61) より上、月初合意ゲート(80) より下に置く。
 */
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useModalContainment({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/35 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[86vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{title}</h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-white text-muted-foreground hover:bg-muted/40"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
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
