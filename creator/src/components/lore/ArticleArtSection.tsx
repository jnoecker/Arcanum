import type { Article } from "@/types/lore";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { getArticlePrompt, getArticleContext, TEMPLATE_ASSET_TYPE } from "@/lib/loreArtPrompts";
import type { AssetContext } from "@/types/assets";

export function ArticleArtSection({
  article,
  onImageChange,
}: {
  article: Article;
  onImageChange: (image: string | undefined) => void;
}) {
  const assetType = TEMPLATE_ASSET_TYPE[article.template] ?? "lore_location";
  const context: AssetContext = {
    zone: "lore",
    entity_type: `lore_${article.template}`,
    entity_id: article.id,
  };

  return (
    <Section title="Art" defaultExpanded={false}>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="Image">
          <TextInput
            value={article.image ?? ""}
            onCommit={(v) => onImageChange(v || undefined)}
            placeholder="None"
          />
        </FieldRow>
        <EntityArtGenerator
          getPrompt={(style) => getArticlePrompt(article, style)}
          entityContext={getArticleContext(article)}
          currentImage={article.image}
          onAccept={(filePath) => onImageChange(filePath)}
          assetType={assetType}
          context={context}
        />
      </div>
    </Section>
  );
}
