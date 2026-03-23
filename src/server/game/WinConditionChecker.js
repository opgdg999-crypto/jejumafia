import { RoleId } from '../../shared/constants/roles.js';

export class WinConditionChecker {
  check(players, lastDeathContext) {
    const alive = Array.from(players.values()).filter(p => p.isAlive);
    const aliveMafia = alive.filter(p => p.team === 'mafia');
    const aliveCitizen = alive.filter(p => p.team === 'citizen');

    // 보스 사망 → 마피아 패배
    const boss = Array.from(players.values()).find(p => p.role === RoleId.BOSS);
    if (boss && !boss.isAlive) {
      return { gameOver: true, winner: 'citizen', reason: '돌하르방 보스가 사망했습니다.' };
    }

    // 도의원 투표 사망 → 시민 패배
    if (lastDeathContext?.cause === 'vote') {
      const deadPlayer = players.get(lastDeathContext.playerId);
      if (deadPlayer?.role === RoleId.COUNCIL_MEMBER) {
        return { gameOver: true, winner: 'mafia', reason: '제주 도의원이 투표로 사망했습니다.' };
      }
    }

    // 마피아 전원 사망 → 시민 승리
    if (aliveMafia.length === 0) {
      return { gameOver: true, winner: 'citizen', reason: '마피아가 전원 제거되었습니다.' };
    }

    // 마피아 수 > 시민 수 → 마피아 승리
    if (aliveMafia.length > aliveCitizen.length) {
      return { gameOver: true, winner: 'mafia', reason: '마피아가 시민보다 많아졌습니다.' };
    }

    return { gameOver: false };
  }
}
