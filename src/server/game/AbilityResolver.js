import { RoleId } from '../../shared/constants/roles.js';

/**
 * 밤 능력 해결 엔진
 *
 * 해결 우선순위:
 *   100  차단 (선무당, 김만덕 할망)
 *    90  바람쟁이 (조사 결과 반전 마킹)
 *    80  보호 (설문대 할망, 의사)
 *    70  킬 (보스, 암살자, 해경)
 *    60  조사 (순경, 이주민)
 *    50  정보 (마당발, 심방, 어부)
 *    40  침묵 (도깨비)
 *    30  기자 (사망 시 취재, 방해 불가)
 */

const PRIORITY = {
  BLOCK: 100,
  WIND_DECEIVE: 90,
  PROTECTION: 80,
  KILL: 70,
  INVESTIGATE: 60,
  INFO: 50,
  SILENCE: 40,
  REPORTER: 30,
  REVIVE: 20,
};

export class AbilityResolver {
  /**
   * @param {Map} players - room.players
   * @param {Object} nightActions - { playerId: { abilityId, targets } }
   * @param {Object} context - { lastVoteDeath }
   */
  constructor(players, nightActions, context) {
    this.players = players;
    this.nightActions = nightActions;
    this.context = context || {};

    // 해결 상태
    this.blockedPlayers = new Set();
    this.windDeceivedPlayers = new Set();
    this.protectorTarget = null;   // 설문대 할망 보호 대상 (보스 킬만 방어)
    this.doctorReviveTarget = null; // 의사 부활 대상
    this.deaths = [];
    this.playerResults = new Map(); // playerId → { abilityId, message, ... }
    this.silencedPlayers = [];
    this.expeditionTargets = [];
    this.saved = false;
    this.revived = false;
  }

  resolve() {
    const actions = this._buildSortedActions();

    for (const action of actions) {
      this._resolveAction(action);
    }

    return {
      deaths: this.deaths,
      saved: this.saved,
      playerResults: this.playerResults,
      silencedPlayers: this.silencedPlayers,
      expeditionTargets: this.expeditionTargets,
    };
  }

  // ── 액션 리스트 생성 ──────────────────────────────────

  _buildSortedActions() {
    const actions = [];

    for (const [playerId, action] of Object.entries(this.nightActions)) {
      if (action.abilityId === 'skip') continue;

      const player = this.players.get(playerId);
      if (!player) continue;

      // 사망자는 기자 취재만 허용
      if (!player.isAlive && action.abilityId !== 'reporter_investigate') continue;

      actions.push({
        playerId,
        player,
        abilityId: action.abilityId,
        targets: action.targets || [],
        priority: this._getPriority(action.abilityId),
        isMongsengi: player.role === RoleId.MONGSENGI,
      });
    }

    // 우선순위 내림차순 정렬
    actions.sort((a, b) => b.priority - a.priority);
    return actions;
  }

  _getPriority(abilityId) {
    const map = {
      'mafia_shaman_block': PRIORITY.BLOCK,
      'blocker_block':      PRIORITY.BLOCK,
      'wind_deceive':       PRIORITY.WIND_DECEIVE,
      'protector_protect':  PRIORITY.PROTECTION,
      'doctor_revive':      PRIORITY.REVIVE,
      'boss_kill':          PRIORITY.KILL,
      'assassin_kill':      PRIORITY.KILL,
      'coast_guard_kill':   PRIORITY.KILL,
      'police_investigate':    PRIORITY.INVESTIGATE,
      'immigrant_investigate': PRIORITY.INVESTIGATE,
      'socialite_compare':     PRIORITY.INFO,
      'fortune_teller_count':  PRIORITY.INFO,
      'fisherman_check':       PRIORITY.INFO,
      'goblin_expedition':  PRIORITY.SILENCE,
      'reporter_investigate': PRIORITY.REPORTER,
    };
    return map[abilityId] || 0;
  }

  // ── 개별 액션 해결 ──────────────────────────────────

  _resolveAction(action) {
    // 기자 취재는 봉인 불가
    if (action.abilityId !== 'reporter_investigate' && this.blockedPlayers.has(action.playerId)) {
      this.playerResults.set(action.playerId, {
        abilityId: action.abilityId,
        blocked: true,
        message: '능력이 봉인되었습니다.',
      });
      return;
    }

    // 몽생이: 가짜 결과 전송 (실제 효과 없음)
    if (action.isMongsengi) {
      this._fakeMongsengiResult(action);
      return;
    }

    switch (action.abilityId) {
      case 'mafia_shaman_block':
      case 'blocker_block':
        this._resolveBlock(action);
        break;
      case 'wind_deceive':
        this._resolveWindDeceive(action);
        break;
      case 'protector_protect':
        this._resolveProtect(action);
        break;
      case 'doctor_revive':
        this._resolveDoctorRevive(action);
        break;
      case 'boss_kill':
        this._resolveBossKill(action);
        break;
      case 'assassin_kill':
        this._resolveAssassinKill(action);
        break;
      case 'coast_guard_kill':
        this._resolveCoastGuardKill(action);
        break;
      case 'police_investigate':
      case 'immigrant_investigate':
        this._resolvePoliceInvestigate(action);
        break;
      case 'socialite_compare':
        this._resolveSocialiteCompare(action);
        break;
      case 'fortune_teller_count':
        this._resolveFortuneTellerCount(action);
        break;
      case 'fisherman_check':
        this._resolveFishermanCheck(action);
        break;
      case 'goblin_expedition':
        this._resolveGoblinExpedition(action);
        break;
      case 'reporter_investigate':
        this._resolveReporterInvestigate(action);
        break;
    }
  }

  // ── Priority 100: 차단 ─────────────────────────────

  _resolveBlock(action) {
    const targetId = action.targets[0];
    if (targetId) {
      this.blockedPlayers.add(targetId);
    }
  }

  // ── Priority 90: 바람쟁이 ──────────────────────────

  _resolveWindDeceive(action) {
    const targetId = action.targets[0];
    if (targetId) {
      this.windDeceivedPlayers.add(targetId);
    }
  }

  // ── Priority 80: 보호 ─────────────────────────────

  _resolveProtect(action) {
    const targetId = action.targets[0];
    if (targetId) {
      this.protectorTarget = targetId;
    }
  }

  _resolveDoctorRevive(action) {
    const targetId = action.targets[0];
    if (!targetId) return;

    const target = this.players.get(targetId);
    if (!target || target.isAlive) return;

    // 기자는 부활 불가
    if (target.role === RoleId.REPORTER) return;

    target.isAlive = true;
    this.revived = true;
    this.playerResults.set(action.playerId, {
      abilityId: 'doctor_revive',
      targetPlayerId: targetId,
      targetName: target.name,
      success: true,
      message: `${target.name}을(를) 부활시켰습니다!`,
    });
  }

  // ── Priority 70: 킬 ───────────────────────────────

  _resolveBossKill(action) {
    const targetId = action.targets[0];
    if (!targetId) return;

    const target = this.players.get(targetId);
    if (!target || !target.isAlive) return;

    // 설문대 할망(보스 킬 전용) 보호
    if (this.protectorTarget === targetId) {
      this.saved = true;
      return;
    }

    this._killPlayer(target, 'mafia_kill', '마피아에 의해 사망');
  }

  _resolveAssassinKill(action) {
    const targetId = action.targets[0];
    if (!targetId) return;

    const target = this.players.get(targetId);
    if (!target || !target.isAlive) return;

    // 암살자 킬은 보호 불가 (설문대 할망은 보스 킬만 방어)

    this._killPlayer(target, 'assassin_kill', '암살자에 의해 사망');
  }

  _resolveCoastGuardKill(action) {
    const targetId = action.targets[0];
    if (!targetId) return;

    const target = this.players.get(targetId);
    if (!target || !target.isAlive) return;

    if (target.team === 'mafia') {
      // 마피아 → 대상 사살
      this._killPlayer(target, 'coast_guard_kill', '해경에 의해 사망');
      this.playerResults.set(action.playerId, {
        abilityId: 'coast_guard_kill',
        success: true,
        message: `${target.name}은(는) 마피아였습니다. 체포 성공!`,
      });
    } else {
      // 시민 → 본인 사망
      this._killPlayer(action.player, 'coast_guard_backfire', '해경의 오판으로 사망');
      this.playerResults.set(action.playerId, {
        abilityId: 'coast_guard_kill',
        success: false,
        message: `${target.name}은(는) 시민이었습니다. 당신이 사망합니다.`,
      });
    }
  }

  // ── Priority 60: 조사 ─────────────────────────────

  _resolvePoliceInvestigate(action) {
    const targetId = action.targets[0];
    if (!targetId) return;

    const target = this.players.get(targetId);
    if (!target) return;

    const apparentTeam = this._getApparentTeam(target, action.playerId);
    this.playerResults.set(action.playerId, {
      abilityId: action.abilityId,
      targetPlayerId: targetId,
      targetName: target.name,
      result: apparentTeam,
      message: `${target.name}의 소속: ${apparentTeam === 'mafia' ? '마피아' : '시민'}`,
    });
  }

  // ── Priority 50: 정보 ─────────────────────────────

  _resolveSocialiteCompare(action) {
    const [target1Id, target2Id] = action.targets;
    if (!target1Id || !target2Id) return;

    const target1 = this.players.get(target1Id);
    const target2 = this.players.get(target2Id);
    if (!target1 || !target2) return;

    const team1 = this._getApparentTeam(target1, action.playerId);
    const team2 = this._getApparentTeam(target2, action.playerId);
    const sameTeam = team1 === team2;

    this.playerResults.set(action.playerId, {
      abilityId: 'socialite_compare',
      target1: { playerId: target1Id, name: target1.name },
      target2: { playerId: target2Id, name: target2.name },
      sameTeam,
      message: `${target1.name}과(와) ${target2.name}은(는) ${sameTeam ? '같은 소속' : '다른 소속'}입니다.`,
    });
  }

  _resolveFortuneTellerCount(action) {
    let citizenAbilityCount = 0;
    for (const [playerId, nightAction] of Object.entries(this.nightActions)) {
      if (nightAction.abilityId === 'skip') continue;
      if (playerId === action.playerId) continue; // 자기 자신 제외
      const player = this.players.get(playerId);
      if (player && player.team === 'citizen' && player.isAlive) {
        citizenAbilityCount++;
      }
    }

    this.playerResults.set(action.playerId, {
      abilityId: 'fortune_teller_count',
      count: citizenAbilityCount,
      message: `이번 밤 능력을 사용한 시민: ${citizenAbilityCount}명`,
    });
  }

  _resolveFishermanCheck(action) {
    const lastVoteDeath = this.context.lastVoteDeath;
    if (!lastVoteDeath) {
      this.playerResults.set(action.playerId, {
        abilityId: 'fisherman_check',
        noTarget: true,
        message: '오늘 투표로 사망한 사람이 없습니다.',
      });
      return;
    }

    const deadPlayer = this.players.get(lastVoteDeath.playerId);
    if (!deadPlayer) return;

    const wasMafia = deadPlayer.team === 'mafia';
    this.playerResults.set(action.playerId, {
      abilityId: 'fisherman_check',
      targetName: deadPlayer.name,
      wasMafia,
      message: `${deadPlayer.name}은(는) ${wasMafia ? '마피아' : '시민'}이었습니다.`,
    });
  }

  // ── Priority 40: 침묵 ─────────────────────────────

  _resolveGoblinExpedition(action) {
    for (const targetId of action.targets) {
      if (!targetId) continue;
      const target = this.players.get(targetId);
      if (!target || !target.isAlive) continue;
      this.expeditionTargets.push({
        playerId: targetId,
        name: target.name,
      });
    }
  }

  // ── Priority 30: 기자 (봉인 불가) ─────────────────

  _resolveReporterInvestigate(action) {
    const targetId = action.targets[0];
    if (!targetId) return;

    const target = this.players.get(targetId);
    if (!target) return;

    // 기자 취재는 정확한 소속 (바람쟁이, 액막이, 밀수업자 영향 X)
    this.playerResults.set(action.playerId, {
      abilityId: 'reporter_investigate',
      targetPlayerId: targetId,
      targetName: target.name,
      result: target.team,
      message: `[취재 결과] ${target.name}의 소속: ${target.team === 'mafia' ? '마피아' : '시민'}`,
    });
  }

  // ── 표시 소속 계산 (조사/비교 시) ─────────────────

  _getApparentTeam(target, investigatorId) {
    let apparentTeam = target.team;

    // 밀수업자: 항상 시민으로 표시
    if (target.role === RoleId.SMUGGLER) {
      apparentTeam = 'citizen';
    }

    // 한량: 항상 마피아로 표시
    if (target.role === RoleId.IDLER) {
      apparentTeam = 'mafia';
    }

    // 액막이(패시브): 생존 중이면 보스가 시민으로 표시
    if (target.role === RoleId.BOSS) {
      const shieldAlive = Array.from(this.players.values()).some(
        p => p.role === RoleId.SHIELD && p.isAlive
      );
      if (shieldAlive) {
        apparentTeam = 'citizen';
      }
    }

    // 바람쟁이: 조사자가 대상이면 결과 반전
    if (this.windDeceivedPlayers.has(investigatorId)) {
      apparentTeam = apparentTeam === 'mafia' ? 'citizen' : 'mafia';
    }

    return apparentTeam;
  }

  // ── 사망 처리 ──────────────────────────────────────

  _killPlayer(player, cause, causeDescription) {
    player.isAlive = false;
    this.deaths.push({
      playerId: player.playerId,
      playerName: player.name,
      cause,
      causeDescription,
    });
  }

  // ── 몽생이 가짜 결과 ──────────────────────────────

  _fakeMongsengiResult(action) {
    switch (action.abilityId) {
      case 'police_investigate':
      case 'immigrant_investigate': {
        const targetId = action.targets[0];
        const target = this.players.get(targetId);
        if (target) {
          const fakeResult = Math.random() > 0.5 ? 'mafia' : 'citizen';
          this.playerResults.set(action.playerId, {
            abilityId: action.abilityId,
            targetPlayerId: targetId,
            targetName: target.name,
            result: fakeResult,
            message: `${target.name}의 소속: ${fakeResult === 'mafia' ? '마피아' : '시민'}`,
          });
        }
        break;
      }
      case 'socialite_compare': {
        const [t1Id, t2Id] = action.targets;
        const t1 = this.players.get(t1Id);
        const t2 = this.players.get(t2Id);
        if (t1 && t2) {
          const fakeSame = Math.random() > 0.5;
          this.playerResults.set(action.playerId, {
            abilityId: 'socialite_compare',
            target1: { playerId: t1Id, name: t1.name },
            target2: { playerId: t2Id, name: t2.name },
            sameTeam: fakeSame,
            message: `${t1.name}과(와) ${t2.name}은(는) ${fakeSame ? '같은 소속' : '다른 소속'}입니다.`,
          });
        }
        break;
      }
      case 'fortune_teller_count': {
        const fakeCount = Math.floor(Math.random() * 3) + 1;
        this.playerResults.set(action.playerId, {
          abilityId: 'fortune_teller_count',
          count: fakeCount,
          message: `이번 밤 능력을 사용한 시민: ${fakeCount}명`,
        });
        break;
      }
      case 'fisherman_check': {
        const lastVoteDeath = this.context.lastVoteDeath;
        if (lastVoteDeath) {
          const deadPlayer = this.players.get(lastVoteDeath.playerId);
          if (deadPlayer) {
            const fakeResult = Math.random() > 0.5;
            this.playerResults.set(action.playerId, {
              abilityId: 'fisherman_check',
              targetName: deadPlayer.name,
              wasMafia: fakeResult,
              message: `${deadPlayer.name}은(는) ${fakeResult ? '마피아' : '시민'}이었습니다.`,
            });
          }
        } else {
          this.playerResults.set(action.playerId, {
            abilityId: 'fisherman_check',
            noTarget: true,
            message: '오늘 투표로 사망한 사람이 없습니다.',
          });
        }
        break;
      }
      default:
        // protector, doctor, blocker 등 → 확인만 (실제 효과 없음)
        break;
    }
  }
}
