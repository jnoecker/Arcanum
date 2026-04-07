import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { removeBgAndSave } from "@/lib/useBackgroundRemoval";
import {
  getPreamble,
  getNegativePrompt,
  getStyleSuffix,
} from "@/lib/arcanumPrompts";
import {
  IMAGE_MODELS,
  imageGenerateCommand,
  resolveImageModel,
  requestsTransparentBackground,
  type GeneratedImage,
} from "@/types/assets";
import type { RequiredGlobalAsset } from "@/lib/requiredGlobalAssets";
import { ActionButton, DialogShell, Spinner } from "@/components/ui/FormWidgets";

type Stage = "compose" | "generating" | "preview" | "removing_bg";

interface Props {
  asset: RequiredGlobalAsset;
  onClose: () => void;
  /** Called with the final file name once the asset is saved + (optionally) bg-removed. */
  onComplete: (fileName: string) => void;
}

const STAGE_LABEL: Record<Stage, string> = {
  compose: "Prompt forge",
  generating: "Rendering",
  removing_bg: "Removing background",
  preview: "Preview",
};

export function GlobalAssetGeneratorModal({ asset, onClose, onComplete }: Props) {
  const settings = useAssetStore((s) => s.settings);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);

  const [stage, setStage] = useState<Stage>("compose");
  const [prompt, setPrompt] = useState(asset.defaultPrompt);
  const [removeBg, setRemoveBg] = useState(asset.transparent);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  // Reset state when the target asset changes
  useEffect(() => {
    setStage("compose");
    setPrompt(asset.defaultPrompt);
    setRemoveBg(asset.transparent);
    setResult(null);
    setError(null);
  }, [asset.key, asset.defaultPrompt, asset.transparent]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = !!(
    settings &&
    ((imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
      (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
      (imageProvider === "openai" && settings.openai_api_key.length > 0))
  );

  const model = resolveImageModel(imageProvider, settings?.image_model);
  const modelId = model?.id ?? IMAGE_MODELS[0]!.id;

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const preamble = getPreamble("gentle_magic", "worldbuilding");
      const styleSuffix = getStyleSuffix("worldbuilding");
      const finalPrompt = `${preamble}\n\n${prompt}\n\n${styleSuffix}`;
      const guidance =
        model && "defaultGuidance" in model
          ? (model as { defaultGuidance: number }).defaultGuidance
          : null;

      const command = imageGenerateCommand(imageProvider);
      const image = await invoke<GeneratedImage>(command, {
        prompt: finalPrompt,
        negativePrompt: getNegativePrompt(asset.assetType),
        model: modelId,
        width: 1024,
        height: 1024,
        steps: model?.defaultSteps ?? null,
        guidance,
        assetType: asset.assetType,
        autoEnhance: false,
        transparentBackground:
          imageProvider === "openai" && requestsTransparentBackground(asset.assetType),
      });
      setResult(image);
      setStage("preview");
    } catch (e) {
      setError(String(e));
      setStage("compose");
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    setAccepting(true);
    setError(null);
    try {
      const variantGroup = `global:${asset.key}`;
      const context = {
        zone: "",
        entity_type: "global_asset",
        entity_id: asset.key,
      };

      // Save the original. If we'll be applying bg removal, the bg-removed
      // variant becomes the active one — otherwise the original is active.
      await acceptAsset(
        result,
        asset.assetType,
        undefined,
        context,
        variantGroup,
        !removeBg,
      );

      let fileName: string;
      if (removeBg) {
        setStage("removing_bg");
        const entry = await removeBgAndSave(
          result.data_url,
          asset.assetType,
          context,
          variantGroup,
        );
        if (!entry) {
          throw new Error(
            "Background removal failed — the original image was saved instead. Try regenerating or disable background removal.",
          );
        }
        fileName = entry.file_name;
      } else {
        fileName = result.file_path.split(/[\\/]/).pop() ?? result.hash;
      }

      onComplete(fileName);
      onClose();
    } catch (e) {
      setError(String(e));
      setStage("preview");
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    setResult(null);
    setError(null);
    setStage("compose");
  };

  if (!hasApiKey) {
    return (
      <DialogShell
        dialogRef={trapRef}
        titleId="global-asset-gen-no-key-title"
        title="Image Provider Required"
        subtitle="Set an image provider key in Config → API Settings before generating global assets."
        widthClassName="max-w-lg"
        onClose={onClose}
        role="alertdialog"
        footer={
          <ActionButton onClick={onClose} variant="primary">
            Close
          </ActionButton>
        }
      >
        <div className="panel-surface-light rounded-3xl p-5 text-sm leading-7 text-text-secondary">
          The art studio is ready, but there is no active provider credential yet.
        </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="global-asset-gen-title"
      title={`Generate: ${asset.label}`}
      subtitle={asset.description}
      widthClassName="max-w-3xl"
      onClose={onClose}
      status={
        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs text-text-secondary">
          {STAGE_LABEL[stage]}
        </span>
      }
      footer={
        <>
          {stage === "compose" && (
            <>
              <ActionButton onClick={onClose} variant="ghost">
                Close
              </ActionButton>
              <ActionButton onClick={handleGenerate} variant="primary">
                Render Artwork
              </ActionButton>
            </>
          )}
          {stage === "preview" && (
            <>
              <ActionButton onClick={handleReject} variant="ghost" disabled={accepting}>
                Reject And Retry
              </ActionButton>
              <ActionButton onClick={handleAccept} disabled={accepting} variant="primary">
                {accepting && <Spinner />}
                {accepting
                  ? removeBg
                    ? "Removing Background"
                    : "Saving"
                  : "Accept Artwork"}
              </ActionButton>
            </>
          )}
        </>
      }
    >
      {stage === "compose" && (
        <div className="grid gap-5">
          <section className="panel-surface-light rounded-3xl p-5">
            <div className="grid gap-5">
              <div className="rounded-3xl border border-white/8 bg-black/12 p-4">
                <p className="text-2xs uppercase tracking-wide-ui text-text-muted">
                  Global asset key
                </p>
                <p className="mt-2 font-mono text-sm text-accent">{asset.key}</p>
                <p className="mt-1 text-2xs text-text-muted">
                  Asset type:{" "}
                  <span className="font-mono text-text-secondary">{asset.assetType}</span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="global-asset-gen-prompt"
                  className="mb-2 block text-2xs uppercase tracking-wide-ui text-text-muted"
                >
                  Prompt
                </label>
                <textarea
                  id="global-asset-gen-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="ornate-input min-h-[10rem] w-full resize-y rounded-3xl px-4 py-4 font-mono text-xs leading-7 text-text-secondary"
                />
                <p className="mt-2 text-2xs text-text-muted">
                  Edit the default prompt above, or generate as-is. The active world
                  visual style and negative prompts are applied automatically.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/8 bg-black/12 p-4">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <div className="flex-1">
                  <div className="font-display text-sm text-text-primary">
                    Remove background after generation
                  </div>
                  <div className="mt-1 text-2xs leading-6 text-text-secondary">
                    Recommended for indicators, overlays, and icons that need to
                    composite cleanly onto rooms or NPCs. Disable for backdrops and
                    full-frame tiles like the world map background.
                  </div>
                </div>
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-3xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error"
                >
                  {error}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {(stage === "generating" || stage === "removing_bg") && (
        <div className="relative overflow-hidden rounded-3xl border border-white/8">
          <div className="relative flex min-h-[20rem] flex-col items-center justify-center gap-5 px-6 py-12 text-center">
            <Spinner className="h-8 w-8 border-2" />
            <p className="font-display text-lg text-text-primary">
              {stage === "generating"
                ? "Rendering global asset..."
                : "Removing background..."}
            </p>
            <p className="max-w-xl text-sm leading-7 text-text-secondary">
              {stage === "generating"
                ? `Conjuring a ${asset.label.toLowerCase()} for your project.`
                : "Isolating the icon so it composites cleanly onto rooms and NPCs."}
            </p>
          </div>
        </div>
      )}

      {stage === "preview" && result && (
        <div className="grid gap-5">
          <section className="panel-surface-light rounded-3xl p-5">
            <div className="overflow-hidden rounded-3xl border border-white/8 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]">
              <img src={result.data_url} alt="Generated global asset" className="w-full" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                {result.width}x{result.height}
              </span>
              <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                {result.model.split("/").pop()}
              </span>
              {removeBg && (
                <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent">
                  Background will be removed
                </span>
              )}
            </div>
            {error && (
              <div
                role="alert"
                className="mt-4 rounded-3xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error"
              >
                {error}
              </div>
            )}
          </section>
        </div>
      )}
    </DialogShell>
  );
}
