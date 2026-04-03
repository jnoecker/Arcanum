import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  ASSET_TEMPLATES,
  getPreamble,
  getEnhanceSystemPrompt,
  composePrompt,
  ART_STYLE_LABELS,
  UNIVERSAL_NEGATIVE,
  type ArtStyle,
} from "@/lib/arcanumPrompts";
import { IMAGE_MODELS, imageGenerateCommand, requestsTransparentBackground } from "@/types/assets";
import type { AssetType, GeneratedImage } from "@/types/assets";
import loadingVignette from "@/assets/loading-vignette.jpg";
import { ActionButton, DialogShell, Spinner } from "./ui/FormWidgets";

const GENERATION_MESSAGES = [
  "The Arcanum renders your vision...",
  "Weaving light from the void...",
  "Shaping form from the aether...",
  "Distilling essence into image...",
  "The cosmos aligns to your intent...",
  "Drawing pigment from starlight...",
  "Illuminating the unseen...",
];

type Stage = "compose" | "generating" | "preview";

export function AssetGenerator() {
  const settings = useAssetStore((s) => s.settings);
  const closeGenerator = useAssetStore((s) => s.closeGenerator);
  const acceptAsset = useAssetStore((s) => s.acceptAsset);
  const updateConfig = useConfigStore((s) => s.updateConfig);

  const [stage, setStage] = useState<Stage>("compose");
  const [artStyle] = useState<ArtStyle>("gentle_magic");
  const [assetType, setAssetType] = useState<AssetType>("background");
  const [modelId, setModelId] = useState<string>(() => {
    const provider = settings?.image_provider ?? "deepinfra";
    return IMAGE_MODELS.find((model) => model.provider === provider)?.id ?? IMAGE_MODELS[0].id;
  });
  const [customization, setCustomization] = useState("");
  const [prompt, setPrompt] = useState(() => composePrompt("background", "gentle_magic"));
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [globalAssetKey, setGlobalAssetKey] = useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(closeGenerator);

  useEffect(() => {
    if (stage !== "generating") {
      setMsgIndex(0);
      return;
    }
    const id = setInterval(() => setMsgIndex((index) => (index + 1) % GENERATION_MESSAGES.length), 3500);
    return () => clearInterval(id);
  }, [stage]);

  const imageProvider = settings?.image_provider ?? "deepinfra";
  const hasApiKey = !!(
    settings &&
    ((imageProvider === "deepinfra" && settings.deepinfra_api_key.length > 0) ||
      (imageProvider === "runware" && settings.runware_api_key.length > 0) ||
      (imageProvider === "openai" && settings.openai_api_key.length > 0))
  );

  const handleTypeChange = (type: AssetType) => {
    setAssetType(type);
    setPrompt(composePrompt(type, artStyle, customization || undefined));
    setEnhancedPrompt("");
    setUseEnhanced(false);
  };

  const handleCustomizationChange = (value: string) => {
    setCustomization(value);
    setPrompt(composePrompt(assetType, artStyle, value || undefined));
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    setError(null);
    try {
      const preamble = getPreamble(artStyle);
      const systemPrompt = getEnhanceSystemPrompt(artStyle);
      const response = await invoke<string>("enhance_prompt", {
        prompt: `${preamble}\n\n${prompt}`,
        systemPrompt,
      });
      setEnhancedPrompt(response);
      setUseEnhanced(true);
    } catch (invokeError) {
      setError(String(invokeError));
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    setStage("generating");
    setError(null);
    try {
      const preamble = getPreamble(artStyle);
      const finalPrompt = useEnhanced && enhancedPrompt ? enhancedPrompt : `${preamble}\n\n${prompt}`;
      const model = IMAGE_MODELS.find((entry) => entry.id === modelId);
      const guidance =
        model && "defaultGuidance" in model ? (model as { defaultGuidance: number }).defaultGuidance : null;

      const command = imageGenerateCommand(imageProvider);
      const image = await invoke<GeneratedImage>(command, {
        prompt: finalPrompt,
        negativePrompt: UNIVERSAL_NEGATIVE,
        model: modelId,
        width: 1024,
        height: 1024,
        steps: model?.defaultSteps ?? null,
        guidance,
        assetType,
        autoEnhance: !(useEnhanced && enhancedPrompt),
        transparentBackground: imageProvider === "openai" && requestsTransparentBackground(assetType),
      });
      setResult(image);
      setStage("preview");
    } catch (invokeError) {
      setError(String(invokeError));
      setStage("compose");
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    setAccepting(true);
    try {
      await acceptAsset(result, assetType, useEnhanced ? enhancedPrompt : undefined);

      if (globalAssetKey.trim()) {
        const latestConfig = useConfigStore.getState().config;
        if (latestConfig) {
          const key = globalAssetKey.trim().toLowerCase().replace(/\s+/g, "_");
          const fileName = result.file_path.split(/[\\/]/).pop() ?? result.hash;
          updateConfig({
            ...latestConfig,
            globalAssets: { ...latestConfig.globalAssets, [key]: fileName },
          });
        }
      }

      closeGenerator();
    } catch (invokeError) {
      setError(String(invokeError));
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = () => {
    setResult(null);
    setStage("compose");
  };

  if (!hasApiKey) {
    return (
      <DialogShell
        dialogRef={trapRef}
        titleId="asset-gen-api-key-title"
        title="Image Provider Required"
        subtitle="Set an image provider key in Config -> API Settings before invoking the generator."
        widthClassName="max-w-lg"
        onClose={closeGenerator}
        role="alertdialog"
        footer={
          <ActionButton onClick={closeGenerator} variant="primary">
            Close
          </ActionButton>
        }
      >
        <div className="panel-surface-light rounded-[24px] p-5 text-sm leading-7 text-text-secondary">
          The art studio is ready, but there is no active provider credential yet.
        </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="asset-gen-title"
      title="Conjure New Art"
      subtitle="Compose the intent, refine the prompt, and let the worldmaking instrument render a new image into the asset vault."
      widthClassName="max-w-5xl"
      onClose={closeGenerator}
      status={
        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-2xs text-text-secondary">
          {stage === "compose" ? "Prompt forge" : stage === "generating" ? "Rendering" : "Preview"}
        </span>
      }
      footer={
        <>
          {stage === "compose" && (
            <>
              <ActionButton onClick={closeGenerator} variant="ghost">
                Close
              </ActionButton>
              <ActionButton onClick={handleGenerate} variant="primary">
                Render Artwork
              </ActionButton>
            </>
          )}
          {stage === "preview" && (
            <>
              <ActionButton onClick={handleReject} variant="ghost">
                Reject And Retry
              </ActionButton>
              <ActionButton onClick={handleAccept} disabled={accepting} variant="primary">
                {accepting && <Spinner />}
                {accepting ? "Saving To Vault" : "Accept Artwork"}
              </ActionButton>
            </>
          )}
        </>
      }
    >
      {stage === "compose" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="panel-surface-light rounded-[26px] p-5">
            <div className="grid gap-5">
              <div className="rounded-[22px] border border-white/8 bg-black/12 p-4">
                <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Style system</p>
                <p className="mt-2 font-display text-base text-text-primary">{ART_STYLE_LABELS[artStyle]}</p>
              </div>

              <div>
                <label className="mb-2 block text-2xs uppercase tracking-wide-ui text-text-muted">Asset Type</label>
                <div role="radiogroup" aria-label="Asset type" className="flex flex-wrap gap-2">
                  {(Object.entries(ASSET_TEMPLATES) as [AssetType, { label: string }][]).map(([key, { label }]) => (
                    <ActionButton
                      key={key}
                      role="radio"
                      aria-checked={assetType === key}
                      onClick={() => handleTypeChange(key)}
                      variant={assetType === key ? "primary" : "secondary"}
                      className="justify-start"
                    >
                      {label}
                    </ActionButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-2xs uppercase tracking-wide-ui text-text-muted">Model</label>
                <div role="radiogroup" aria-label="Model" className="grid gap-3">
                  {IMAGE_MODELS.filter((model) => model.provider === imageProvider).map((model) => (
                    <button
                      key={model.id}
                      role="radio"
                      aria-checked={modelId === model.id}
                      onClick={() => setModelId(model.id)}
                      className={`focus-ring rounded-[22px] border p-4 text-left transition ${
                        modelId === model.id
                          ? "border-[var(--border-glow-strong)] bg-[linear-gradient(145deg,rgba(168,151,210,0.18),rgba(42,50,71,0.9))] shadow-glow-sm"
                          : "border-white/8 bg-black/12 hover:border-white/14 hover:bg-white/6"
                      }`}
                    >
                      <div className="font-display text-sm text-text-primary">{model.label}</div>
                      <div className="mt-1 text-xs leading-6 text-text-secondary">{model.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="asset-gen-customization" className="mb-2 block text-2xs uppercase tracking-wide-ui text-text-muted">
                  Customization
                </label>
                <input
                  id="asset-gen-customization"
                  type="text"
                  value={customization}
                  onChange={(e) => handleCustomizationChange(e.target.value)}
                  placeholder="Forest clearing with ancient ruins, storm-lit harbor, ruined observatory..."
                  className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
                />
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <label htmlFor="asset-gen-prompt" className="text-2xs uppercase tracking-wide-ui text-text-muted">Prompt</label>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {enhancedPrompt && (
                      <>
                        <ActionButton
                          onClick={() => setUseEnhanced(true)}
                          variant={useEnhanced ? "primary" : "ghost"}
                          size="sm"
                        >
                          Enhanced
                        </ActionButton>
                        <ActionButton
                          onClick={() => setUseEnhanced(false)}
                          variant={!useEnhanced ? "primary" : "ghost"}
                          size="sm"
                        >
                          Original
                        </ActionButton>
                      </>
                    )}
                    <ActionButton onClick={handleEnhance} disabled={enhancing} variant="secondary">
                      {enhancing && <Spinner />}
                      {enhancing ? "Enhancing" : "Refine Prompt"}
                    </ActionButton>
                  </div>
                </div>
                <textarea
                  id="asset-gen-prompt"
                  value={useEnhanced && enhancedPrompt ? enhancedPrompt : prompt}
                  onChange={(e) => {
                    if (useEnhanced) {
                      setEnhancedPrompt(e.target.value);
                    } else {
                      setPrompt(e.target.value);
                    }
                  }}
                  rows={8}
                  className="ornate-input min-h-[15rem] w-full resize-y rounded-[22px] px-4 py-4 font-mono text-xs leading-7 text-text-secondary"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-[22px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
                  {error}
                </div>
              )}
            </div>
          </section>

          <aside className="instrument-panel rounded-[28px] p-5">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Render intent</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-text-secondary">
              <p>
                Use asset type to control composition, then add only the details that make this image belong to the world you are building.
              </p>
              <div className="rounded-[22px] border border-white/8 bg-black/12 p-4">
                <p className="font-display text-sm text-text-primary">Best results</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-secondary">
                  <li>Name atmosphere before decoration.</li>
                  <li>Use one memorable landmark or gesture.</li>
                  <li>Keep background and subject intent consistent.</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      )}

      {stage === "generating" && (
        <div className="relative overflow-hidden rounded-[30px] border border-white/8">
          <img src={loadingVignette} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-secondary via-bg-secondary/78 to-bg-secondary/55" />
          <div className="relative flex min-h-[24rem] flex-col items-center justify-center gap-5 px-6 py-12 text-center">
            <Spinner className="h-8 w-8 border-2" />
            <p className="font-display text-lg text-text-primary">{GENERATION_MESSAGES[msgIndex]}</p>
            <p className="max-w-xl text-sm leading-7 text-text-secondary">
              Creator is preparing a {ASSET_TEMPLATES[assetType].label.toLowerCase()} using {IMAGE_MODELS.find((model) => model.id === modelId)?.label ?? "the selected model"}.
            </p>
          </div>
        </div>
      )}

      {stage === "preview" && result && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="panel-surface-light rounded-[26px] p-5">
            <div className="overflow-hidden rounded-[22px] border border-white/8 bg-black/14">
              <img src={result.data_url} alt="Generated art" className="w-full" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                {result.width}x{result.height}
              </span>
              <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1">
                {result.model.split("/").pop()}
              </span>
            </div>
            {error && (
              <div role="alert" className="mt-4 rounded-[22px] border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
                {error}
              </div>
            )}
          </section>

          <aside className="instrument-panel rounded-[28px] p-5">
            <p className="text-2xs uppercase tracking-wide-ui text-text-muted">Archive</p>
            <div className="mt-4">
              <label htmlFor="asset-gen-global-key" className="mb-1.5 block text-2xs uppercase tracking-wide-ui text-text-muted">
                Save As Global Asset
              </label>
              <input
                id="asset-gen-global-key"
                type="text"
                value={globalAssetKey}
                onChange={(e) => setGlobalAssetKey(e.target.value)}
                placeholder="compass_rose, world_map, login_splash"
                className="ornate-input min-h-11 w-full rounded-2xl px-4 py-3 text-sm"
              />
              <p className="mt-2 text-xs leading-6 text-text-secondary">
                Optional. Provide a key and Creator will register the accepted image under <span className="font-mono">images.globalAssets</span>.
              </p>
            </div>
          </aside>
        </div>
      )}
    </DialogShell>
  );
}
