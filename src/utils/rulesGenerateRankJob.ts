/**
 * Regras para o rank do job de geração (feedback): palavras ofensivas e detecção de link.
 * Palavras ofensivas em minúsculas para comparação case-insensitive.
 */
export const OFFENSIVE_WORDS_PT: string[] = [
  'caralho', 'porra', 'merda', 'puta', 'putas', 'buceta', 'vagabunda', 'vagabundo',
  'viado', 'viada', 'foda', 'foder', 'fodido', 'cu', 'cuzão', 'arrombado', 'arrombada',
  'bosta', 'desgraça', 'idiota', 'imbecil', 'estupido', 'estúpido', 'retardado', 'retardada',
  'nojent', 'nojento', 'nojenta', 'escroto', 'escrota', 'babaca', 'otario', 'otário',
  'palhaço', 'palhaco', 'lixo', 'lixos', 'cancer', 'câncer', 'morra', 'morram', 'morte',
  'fdp', 'filha da puta', 'filho da puta', 'vai se foder', 'vsf', 'vtnc',
  'vai tomar no cu', 'tomar no cu', 'corno', 'corna', 'canalha', 'safado', 'safada',
  'maldito', 'maldita', 'infeliz', 'lazaro', 'lazarento', 'lazarenta',
  'piranha', 'galinha', 'puta merda', 'pqp', 'que porra', 'vai à merda',
  'burro', 'burra', 'animal', 'besta', 'cretino', 'cretina', 'cuzinho',
  'broxa', 'impotente', 'paneleiro', 'traveco', 'bicha', 'veado',
  'macaco', 'macaca', 'nego', 'neguinho',
  'nordestino',
  'cachorra', 'vadia', 'rapariga',
  'mete o dedo', 'chupa', 'mama', 'lambe',
  'tnc', 'tmnc', 'tmj não', 'se mata',
];

export const OFFENSIVE_WORDS_EN: string[] = [
  'motherfucker', 'motherfucking', 'mf', 'mofo',
  'asshole', 'assholes', 'piece of shit', 'pos', 'bs', 'bullshit',
  'dumbass', 'dumbfuck', 'dipshit', 'jackass', 'jackasses',
  'son of a bitch', 'sob', 'bitch ass', 'punk ass',
  'whore', 'whorish', 'slutty', 'hoe', 'thot',
  'scumbag', 'scum', 'trash', 'garbage', 'loser',
  'crap', 'crappy', 'piss', 'pissed', 'shitty', 'shithead',
  'pervert', 'creep', 'pedo', 'predator',
  'nazi', 'fascist',
  'go to hell', 'go fuck yourself', 'gfy', 'gtfo',
  'kys', 'kill urself', 'end yourself',
  'kkk',
  'spic', 'wetback', 'chink', 'gook', 'towelhead',
  'tranny', 'shemale',
  'dyke', 'lesbo',
  'fat ass', 'fatso', 'lardass',
  'prick', 'twat', 'wanker', 'tosser',
  'bloody hell', 'bollocks', 'bugger',
  'cum', 'cumshot', 'jizz',
];

export const OFFENSIVE_WORDS_PT_EN: string[] = [...OFFENSIVE_WORDS_PT, ...OFFENSIVE_WORDS_EN];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}
const OFFENSIVE_REGEX = new RegExp(
  '\\b(' + OFFENSIVE_WORDS_PT_EN.map(escapeRegex).join('|') + ')\\b',
  'gi'
);

/** Retorna true se o texto contiver alguma palavra ofensiva (pt ou en). */
export function hasOffensiveWord(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return OFFENSIVE_REGEX.test(text);
}

/** Detecta se o texto contém algo que parece link (http/https ou www). */
export function hasLink(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /https?:\/\//i.test(text) || /\bwww\./i.test(text);
}
