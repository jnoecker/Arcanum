# Factions & Reputation — migration complete

This was a companion spec listing the AmbonMUD server changes needed to
consume the faction/reputation YAML that Arcanum writes. **All of it has
shipped server-side** and this file is retained only as a stub:

- `FactionsConfig.tiers` (`ReputationTier { id, label, minReputation }`) with
  default fallback — **implemented**.
- Zone-level controlling `faction` on `WorldFile` — **implemented**.
- `requiredReputation` gates on shops and quests
  (`ReputationRequirement { faction, min?, max? }`) — **implemented**.

The lore-article `organization.configFactionId` field remains Arcanum-only
(it lives in `lore.yaml` and is not exposed to the MUD).

The full original specification — including the worked examples, validation
rules, and the server-side testing checklist — is preserved in this file's
git history.
