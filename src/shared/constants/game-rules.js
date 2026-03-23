export const MIN_PLAYERS = 8;
export const MAX_PLAYERS = 16;
export const MAX_ROOMS = 2;

export function getMafiaCount(playerCount) {
  if (playerCount >= 13) return 4;
  if (playerCount >= 10) return 3;
  return 2;
}

export const DEFAULT_TIMERS = {
  dayBase: 480,       // 8분
  dayDecrement: 60,   // 라운드당 1분 감소
  dayMinimum: 180,    // 최소 3분
  vote: 50,           // 50초
  lastWords: 10,      // 10초
  night: 60,          // 1분
};

export function getDayTimer(roundNumber, config) {
  const timer = config.dayBase - (roundNumber - 1) * config.dayDecrement;
  return Math.max(timer, config.dayMinimum);
}
