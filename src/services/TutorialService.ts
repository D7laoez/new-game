import { StorageService } from './StorageService.ts';

export interface TutorialProgress {
  seenGameIds: string[];
  completedGameIds: string[];
  dismissed: boolean;
}

const STORAGE_KEY = 'tutorial_progress_v1';

const TUTORIALS: Record<string, { title:string; titleAr:string; steps:string[]; tips:string[]; icon:string; category:string }> = {
  'quick-tap': { title:'Quick Tap', titleAr:'النقرة السريعة', icon:'⚡', category:'REACTION', steps:['Wait for GREEN signal','Tap immediately','False start = penalty!'], tips:['Watch the lights','Stay focused'] },
  'rapid-tap': { title:'Rapid Tap', titleAr:'الضغط السريع', icon:'🔥', category:'SPEED', steps:['Mash as fast as you can','Fill your meter','Highest taps wins'], tips:['Use two fingers','Stay rhythmic'] },
  'tug-of-war': { title:'Tug Of War', titleAr:'شد الحبل', icon:'🪢', category:'COMPETITION', steps:['Mash to pull rope','Drag rivals into mud','Hold until timer ends'], tips:['Alternate fingers'] },
  'pattern-memory': { title:'Pattern Memory', titleAr:'ذاكرة الأنماط', icon:'🔮', category:'MEMORY', steps:['Watch flashing pads','Repeat the sequence','Sequence grows each level'], tips:['Chunk colors'] },
  'coin-rush': { title:'Coin Rush', titleAr:'سباق العملات', icon:'🪙', category:'COMPETITION', steps:['Tap coins & gems','Avoid bombs','Most points wins'], tips:['Scan whole arena'] },
  'color-clash': { title:'Color Clash', titleAr:'صراع الألوان', icon:'🎨', category:'REACTION', steps:['Target color appears','Tap matching button first','Wrong tap = penalty'], tips:['Focus on target name'] },
  'bomb-pass': { title:'Bomb Pass', titleAr:'تمرير القنبلة', icon:'💣', category:'PARTY', steps:['Bomb ticks randomly','Tap to pass it','Holder when explodes loses'], tips:['Pass quickly'] },
};

export class TutorialService {
  private progress: TutorialProgress;
  constructor() {
    const def: TutorialProgress = { seenGameIds:[], completedGameIds:[], dismissed:false };
    const raw = StorageService.getItem<Partial<TutorialProgress>>(STORAGE_KEY, def);
    this.progress = {
      seenGameIds: Array.isArray(raw.seenGameIds)? raw.seenGameIds as string[] : [],
      completedGameIds: Array.isArray(raw.completedGameIds)? raw.completedGameIds as string[] : [],
      dismissed: !!raw.dismissed,
    };
  }
  private save(): void { StorageService.setItem(STORAGE_KEY, this.progress); }
  getProgress(): TutorialProgress { return JSON.parse(JSON.stringify(this.progress)); }
  hasSeen(gameId:string): boolean { return this.progress.seenGameIds.includes(gameId); }
  markSeen(gameId:string): void { if(!this.progress.seenGameIds.includes(gameId)){ this.progress.seenGameIds.push(gameId); this.save(); } }
  markCompleted(gameId:string): void { if(!this.progress.completedGameIds.includes(gameId)){ this.progress.completedGameIds.push(gameId); this.save(); } }
  shouldShow(gameId:string): boolean { if(this.progress.dismissed) return false; return !this.hasSeen(gameId); }
  dismissAll(): void { this.progress.dismissed=true; this.save(); }
  reset(): void { this.progress={ seenGameIds:[], completedGameIds:[], dismissed:false }; this.save(); }
  getTutorial(gameId:string): { title:string; titleAr:string; steps:string[]; tips:string[]; icon:string; category:string } | null {
    return TUTORIALS[gameId] ?? null;
  }
  static getAllIds(): string[] { return Object.keys(TUTORIALS); }
}
