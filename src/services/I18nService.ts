export type Language = 'en' | 'ar';

export interface Translations {
  miniGamesBadge: string;
  partyGamesTitle: string;
  quickParty: string;
  instantFun: string;
  quickPartyDesc: string;
  playNow: string;
  tournament: string;
  tournamentDesc: string;
  customParty: string;
  customPartyDesc: string;
  gameLibrary: string;
  gameLibraryDesc: string;
  playersAndAvatars: string;
  playersDesc: string;
  playersCount: (n: number) => string;
  roundIndicator: (current: number, total: number) => string;
  quitConfirm: string;
  getReady: string;
  winner: string;
  standings: string;
  nextRound: string;
  returnToMenu: string;
  playAgain: string;
  pts: string;
  rank: string;
  player: string;
  settings: string;
  sound: string;
  haptics: string;
  language: string;
  achievements: string;
  statistics: string;
  totalGames: string;
  winRate: string;
  cupsWon: string;
  streak: string;
}

export const i18nDict: Record<Language, Translations> = {
  en: {
    miniGamesBadge: '50+ MINI-GAMES',
    partyGamesTitle: 'PARTY GAMES',
    quickParty: 'QUICK PARTY',
    instantFun: '⚡ INSTANT FUN',
    quickPartyDesc: '3 Fast Random Rounds for you and your friends',
    playNow: 'PLAY NOW 🎮',
    tournament: 'Tournament',
    tournamentDesc: 'Bronze, Silver, Gold & Ultimate Championship Cups',
    customParty: 'Custom Party',
    customPartyDesc: 'Choose rounds & select game categories',
    gameLibrary: 'Game Library',
    gameLibraryDesc: 'Explore 55 games & play any directly',
    playersAndAvatars: 'Players & Avatars',
    playersDesc: 'Customize names, colors & pick 1-4 players',
    playersCount: (n: number) => `👥 ${n} Players`,
    roundIndicator: (c: number, t: number) => `Round ${c} / ${t}`,
    quitConfirm: 'Quit back to main menu?',
    getReady: 'GET READY!',
    winner: '🏆 WINNER',
    standings: 'Current Standings',
    nextRound: 'NEXT ROUND ⏩',
    returnToMenu: 'MAIN MENU 🏠',
    playAgain: 'PLAY AGAIN 🔄',
    pts: 'pts',
    rank: 'Rank',
    player: 'Player',
    settings: 'Settings',
    sound: 'Sound FX',
    haptics: 'Vibration',
    language: 'Language',
    achievements: 'Achievements',
    statistics: 'Statistics',
    totalGames: 'Total Games',
    winRate: 'Win Rate',
    cupsWon: 'Cups Won',
    streak: 'Best Streak'
  },
  ar: {
    miniGamesBadge: '+50 لعبة حماسية',
    partyGamesTitle: 'ألعاب الحفلة',
    quickParty: 'لعب سريع',
    instantFun: '⚡ متعة فورية',
    quickPartyDesc: '٣ جولات عشوائية سريعة لك ولأصدقائك على نفس الشاشة',
    playNow: 'العب الآن 🎮',
    tournament: 'بطولة الكؤوس',
    tournamentDesc: 'كؤوس برونزية، فضية، ذهبية وكأس الأبطال النهائي',
    customParty: 'حفلة مخصصة',
    customPartyDesc: 'حدد عدد الجولات وتصنيفات الألعاب المفضلة',
    gameLibrary: 'مكتبة الألعاب',
    gameLibraryDesc: 'استكشف ٥٥ لعبة واختر لعبتك المفضلة مباشرة',
    playersAndAvatars: 'اللاعبين والشخصيات',
    playersDesc: 'تخصيص الأسماء والألوان واختيار من ١ إلى ٤ لاعبين',
    playersCount: (n: number) => `👥 ${n} لاعبين`,
    roundIndicator: (c: number, t: number) => `الجولة ${c} من ${t}`,
    quitConfirm: 'هل تريد الخروج إلى القائمة الرئيسية؟',
    getReady: 'استعد للعب!',
    winner: '🏆 الفائز بالبطولة',
    standings: 'الترتيب الحالي',
    nextRound: 'الجولة التالية ⏩',
    returnToMenu: 'القائمة الرئيسية 🏠',
    playAgain: 'العب مجدداً 🔄',
    pts: 'نقطة',
    rank: 'الترتيب',
    player: 'اللاعب',
    settings: 'الإعدادات',
    sound: 'المؤثرات الصوتية',
    haptics: 'الاهتزاز',
    language: 'اللغة',
    achievements: 'الإنجازات',
    statistics: 'الإحصائيات',
    totalGames: 'إجمالي الألعاب',
    winRate: 'نسبة الفوز',
    cupsWon: 'الكؤوس المحققة',
    streak: 'أعلى سلسلة فوز'
  }
};
