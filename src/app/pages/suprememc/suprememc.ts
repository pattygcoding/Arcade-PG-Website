import { ChangeDetectionStrategy, Component } from '@angular/core';
import { strings } from '../../i18n/i18n';
import { SUPREMEMC_ICONS, SvgIcon } from './suprememc-icons';

const LINKS = {
  github: 'https://github.com/pattygcoding/SupremeMC-26.2-Mod',
  curseforge: 'https://www.curseforge.com/minecraft/mc-mods/suprememc',
} as const;

// Technology names are proper nouns, so they are not part of the locale bundle.
const STACK = [
  'Java',
  'Kotlin',
  'Gradle',
  'Fabric',
  'NeoForge',
  'MultiLoader',
  'Data Generators',
];

type FeatureKey = 'gear' | 'mobs' | 'worlds' | 'structures' | 'explosives' | 'magic';

interface Stat {
  label: string;
  value: string;
}

interface Feature {
  key: FeatureKey;
  title: string;
  text: string;
  examples: readonly string[];
  icon: SvgIcon;
}

interface TimelineEntry {
  version: string;
  text: string;
}

const STATS: readonly Stat[] = [
  { label: strings.suprememc.stats.items, value: '330+' },
  { label: strings.suprememc.stats.blocks, value: '260+' },
  { label: strings.suprememc.stats.enchantments, value: '18' },
  { label: strings.suprememc.stats.potions, value: '13' },
];

const FEATURES: readonly Feature[] = [
  {
    key: 'gear',
    title: strings.suprememc.features.gear.title,
    text: strings.suprememc.features.gear.text,
    examples: strings.suprememc.features.gear.examples,
    icon: SUPREMEMC_ICONS.gear,
  },
  {
    key: 'mobs',
    title: strings.suprememc.features.mobs.title,
    text: strings.suprememc.features.mobs.text,
    examples: strings.suprememc.features.mobs.examples,
    icon: SUPREMEMC_ICONS.mobs,
  },
  {
    key: 'worlds',
    title: strings.suprememc.features.worlds.title,
    text: strings.suprememc.features.worlds.text,
    examples: strings.suprememc.features.worlds.examples,
    icon: SUPREMEMC_ICONS.worlds,
  },
  {
    key: 'structures',
    title: strings.suprememc.features.structures.title,
    text: strings.suprememc.features.structures.text,
    examples: strings.suprememc.features.structures.examples,
    icon: SUPREMEMC_ICONS.structures,
  },
  {
    key: 'explosives',
    title: strings.suprememc.features.explosives.title,
    text: strings.suprememc.features.explosives.text,
    examples: strings.suprememc.features.explosives.examples,
    icon: SUPREMEMC_ICONS.explosives,
  },
  {
    key: 'magic',
    title: strings.suprememc.features.magic.title,
    text: strings.suprememc.features.magic.text,
    examples: strings.suprememc.features.magic.examples,
    icon: SUPREMEMC_ICONS.magic,
  },
];

@Component({
  selector: 'app-suprememc',
  templateUrl: './suprememc.html',
  styleUrl: './suprememc.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupremeMc {
  protected readonly t = strings;
  protected readonly icons = SUPREMEMC_ICONS;
  protected readonly links = LINKS;
  protected readonly stats = STATS;
  protected readonly features = FEATURES;
  protected readonly stack = STACK;
  protected readonly timeline: readonly TimelineEntry[] = strings.suprememc.build.timeline;
}
