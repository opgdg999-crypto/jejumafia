import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { PhaseManager } from './PhaseManager.js';
import { VoteManager } from './VoteManager.js';
import { WinConditionChecker } from './WinConditionChecker.js';
import { AbilityResolver } from './AbilityResolver.js';
import { getMafiaCount } from '../../shared/constants/game-rules.js';
import { RoleId, RoleTeam, ROLE_META } from '../../shared/constants/roles.js';

export class GameEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.gameId = uuidv4();
    this.players = room.players;
    this.config = room.config;

    this.phaseManager = new PhaseManager(this.config.timers);
    this.voteManager = new VoteManager();
    this.winChecker = new WinConditionChecker();

    this.deathLog = [];
    this.nightActions = {};
    this.lastVoteDeath = null;
    this.skipVotes = new Set(); // 스킵 투표한 플레이어
    this.pendingReporterInvestigation = null;  // 투표 사망 기자 (밤에 조사)
    this.nightDeathReporter = null;            // 밤 사망 기자 (새벽에 조사)
    this.reporterInvestigationResult = null;
    this.cachedNightResult = null;

    this._setupPhaseListeners();
  }

  // ══════════════════════════════════════════════════════
  //  게임 시작
  // ══════════════════════════════════════════════════════

  start() {
    this._assignRoles();
    this._notifyRoles();
    this.phaseManager.startGame();
  }

  // ══════════════════════════════════════════════════════
  //  역할 배정
  // ══════════════════════════════════════════════════════

  _assignRoles() {
    const playerCount = this.players.size;
    const mafiaCount = this.config.mafiaCount === 'auto'
      ? getMafiaCount(playerCount)
      : Math.min(this.config.mafiaCount, Math.floor(playerCount / 2) - 1);
    const playerList = Array.from(this.players.values());

    // 사용 가능한 역할 필터링
    const enabledRoles = this.config.rolePool
      .filter(slot => slot.enabled)
      .map(slot => slot.roleId);

    const availableMafia = enabledRoles
      .filter(id => ROLE_META[id]?.team === RoleTeam.MAFIA)
      .filter(id => (ROLE_META[id]?.minPlayers || 0) <= playerCount);

    const availableCitizen = enabledRoles
      .filter(id => ROLE_META[id]?.team === RoleTeam.CITIZEN)
      .filter(id => (ROLE_META[id]?.minPlayers || 0) <= playerCount);

    // 셔플
    this._shuffle(playerList);
    this._shuffle(availableMafia);
    this._shuffle(availableCitizen);

    // 보스는 반드시 포함
    const mafiaRoles = [RoleId.BOSS];
    const remainingMafia = availableMafia.filter(id => id !== RoleId.BOSS);
    for (let i = 0; i < mafiaCount - 1 && i < remainingMafia.length; i++) {
      mafiaRoles.push(remainingMafia[i]);
    }

    // 시민 역할 (몽생이 제외하고 배정)
    const citizenCount = playerCount - mafiaCount;
    const citizenRoles = [];
    const citizenWithoutMongsengi = availableCitizen.filter(id => id !== RoleId.MONGSENGI);

    for (let i = 0; i < citizenCount && i < citizenWithoutMongsengi.length; i++) {
      citizenRoles.push(citizenWithoutMongsengi[i]);
    }

    // 부족하면 기본 시민으로 채움
    while (citizenRoles.length < citizenCount) {
      citizenRoles.push(null);
    }

    // 몽생이 처리: 활성화 시 시민 중 하나를 몽생이로 교체
    const hasMongsengi = enabledRoles.includes(RoleId.MONGSENGI);
    let mongsengiDisplayRole = null;

    if (hasMongsengi && citizenRoles.length > 1) {
      const mongsengiIndex = citizenRoles.length - 1;
      mongsengiDisplayRole = citizenRoles[mongsengiIndex];
      citizenRoles[mongsengiIndex] = RoleId.MONGSENGI;
    }

    // 배정
    const allRoles = [...mafiaRoles, ...citizenRoles];
    this._shuffle(allRoles);

    playerList.forEach((player, i) => {
      const role = allRoles[i];
      if (role === null) {
        player.role = 'citizen_basic';
        player.displayRole = 'citizen_basic';
        player.team = 'citizen';
      } else if (role === RoleId.MONGSENGI) {
        player.role = RoleId.MONGSENGI;
        player.displayRole = mongsengiDisplayRole || RoleId.POLICE;
        player.team = 'citizen';
      } else {
        const meta = ROLE_META[role];
        player.role = role;
        player.displayRole = role;
        player.team = meta?.team || 'citizen';
      }
    });
  }

  _notifyRoles() {
    const mafiaMembers = Array.from(this.players.values())
      .filter(p => p.team === 'mafia')
      .map(p => ({ playerId: p.playerId, name: p.name }));

    for (const player of this.players.values()) {
      const roleToShow = player.displayRole;
      const meta = ROLE_META[roleToShow] || {
        nameKo: '시민',
        team: player.team,
        description: '특별한 능력이 없는 시민입니다.',
        abilities: [],
      };

      const roleData = {
        role: roleToShow,
        team: player.team,
        description: meta.description,
        abilities: meta.abilities || [],
      };

      // 마피아 팀원 공유
      if (player.team === 'mafia') {
        roleData.teamMembers = mafiaMembers.filter(m => m.playerId !== player.playerId);
      }

      // 이장 부씨: 시민 한 명 공개
      if (player.role === RoleId.VILLAGE_HEAD) {
        const citizens = Array.from(this.players.values())
          .filter(p => p.team === 'citizen' && p.playerId !== player.playerId && p.role !== RoleId.MONGSENGI);
        if (citizens.length > 0) {
          const revealed = citizens[Math.floor(Math.random() * citizens.length)];
          roleData.knownCitizen = {
            playerId: revealed.playerId,
            name: revealed.name,
            role: revealed.role,
          };
        }
      }

      this.emit('role:assigned', player.playerId, roleData);
    }
  }

  // ══════════════════════════════════════════════════════
  //  페이즈 리스너
  // ══════════════════════════════════════════════════════

  _setupPhaseListeners() {
    this.phaseManager.on('phase:changed', (phase) => {
      this.emit('phase:changed', phase);
      this._onPhaseStart(phase);
    });

    this.phaseManager.on('phase:timer_tick', (remaining) => {
      this.emit('phase:timer_tick', remaining);
    });

    this.phaseManager.on('phase:timer_expired', (phase) => {
      this._onPhaseEnd(phase);
    });
  }

  _onPhaseStart(phase) {
    this.skipVotes.clear(); // 새 페이즈 시작 시 스킵 투표 초기화

    switch (phase.type) {
      case 'day_discussion':
        this.lastVoteDeath = null;
        // 침묵 해제 (다음 라운드)
        for (const player of this.players.values()) {
          player.isSilenced = false;
        }
        break;

      case 'day_vote': {
        const targets = Array.from(this.players.values())
          .filter(p => p.isAlive)
          .map(p => p.playerId);
        this.voteManager.openVote(targets);
        this.emit('vote:opened', { eligibleTargets: targets, isRevote: false });
        break;
      }

      case 'day_vote_revote': {
        const targets = phase.voteTargets || [];
        this.voteManager.openVote(targets);
        this.emit('vote:opened', { eligibleTargets: targets, isRevote: true });
        break;
      }

      case 'day_kill_save_vote': {
        const target = phase.voteTargets?.[0];
        this.voteManager.openVote([target], true);
        this.emit('vote:opened', {
          eligibleTargets: [target],
          isRevote: false,
          isKillSaveVote: true,
        });
        break;
      }

      case 'night_abilities':
        this.nightActions = {};
        this.emit('night:started');
        break;

      case 'night_reporter_investigation':
        // 밤 사망 기자에게 조사 프롬프트 전송
        if (this.nightDeathReporter) {
          this.emit('reporter:investigate', this.nightDeathReporter);
        }
        break;
    }
  }

  _onPhaseEnd(phase) {
    switch (phase.type) {
      case 'day_discussion':
        this._startVoting();
        break;

      case 'day_vote':
      case 'day_vote_revote':
        this._resolveVote(phase);
        break;

      case 'day_kill_save_vote':
        this._resolveKillSaveVote();
        break;

      case 'day_last_words':
        this._afterLastWords();
        break;

      case 'night_abilities':
        this._resolveNight();
        break;

      case 'night_reporter_investigation':
        this._completeReporterInvestigation();
        break;

      case 'dawn_reveal':
        this._startNewDay();
        break;
    }
  }

  // ══════════════════════════════════════════════════════
  //  투표
  // ══════════════════════════════════════════════════════

  _startVoting() {
    const targets = Array.from(this.players.values())
      .filter(p => p.isAlive)
      .map(p => p.playerId);
    this.phaseManager.transitionToVote(targets);
  }

  handleVote(playerId, targetId) {
    const phase = this.phaseManager.getPhase();

    if (phase.type === 'day_kill_save_vote') {
      this.voteManager.castKillSaveVote(playerId, targetId);
    } else {
      this.voteManager.castVote(playerId, targetId);
    }

    // 투표 현황 업데이트
    const allPlayers = Array.from(this.players.values());
    const status = this.voteManager.getVoteStatus(allPlayers.length);
    this.emit('vote:count_update', status);

    // 모든 플레이어가 투표했으면 즉시 종료
    if (this.voteManager.hasEveryoneVoted(allPlayers)) {
      this.phaseManager.advancePhase();
    }
  }

  handleDoubleVote(playerId) {
    this.voteManager.activateDoubleVote(playerId);
  }

  _resolveVote(phase) {
    const result = this.voteManager.resolve(this.players);
    this.emit('vote:result', result);

    if (result.outcome === 'kill') {
      this.phaseManager.transitionToKillSaveVote(result.eliminated);
    } else if (result.outcome === 'tie') {
      if (phase.isRevote) {
        this.emit('vote:result', { outcome: 'save', counts: result.counts });
        this._goToNight();
      } else {
        this.phaseManager.transitionToVote(result.tiedPlayers, true);
      }
    } else {
      this._goToNight();
    }
  }

  _resolveKillSaveVote() {
    const result = this.voteManager.resolve(this.players);
    this.emit('vote:result', result);

    if (result.outcome === 'kill' && result.eliminated) {
      const player = this.players.get(result.eliminated);
      if (player) {
        player.isAlive = false;
        this.lastVoteDeath = { playerId: player.playerId, cause: 'vote' };
        this.deathLog.push({
          playerId: player.playerId,
          playerName: player.name,
          roundNumber: this.phaseManager.getRoundNumber(),
          cause: 'vote',
          phase: 'day_kill_save_vote',
        });

        // 승리 조건 체크
        const winCheck = this.winChecker.check(this.players, { playerId: player.playerId, cause: 'vote' });
        if (winCheck.gameOver) {
          this._endGame(winCheck.winner, winCheck.reason);
          return;
        }

        // 최후 변론
        this.phaseManager.transitionTo('day_last_words');
        return;
      }
    }

    this._goToNight();
  }

  _afterLastWords() {
    // 기자 사망 체크 (투표 사망 → 밤에 조사)
    if (this.lastVoteDeath) {
      const deadPlayer = this.players.get(this.lastVoteDeath.playerId);
      if (deadPlayer?.role === RoleId.REPORTER) {
        this.pendingReporterInvestigation = deadPlayer.playerId;
      }
    }
    this._goToNight();
  }

  _goToNight() {
    this.phaseManager.transitionTo('night_abilities');
  }

  // ══════════════════════════════════════════════════════
  //  밤 능력
  // ══════════════════════════════════════════════════════

  handleAbility(playerId, abilityId, targets) {
    const phase = this.phaseManager.getPhase();

    // 밤 사망 기자의 조사
    if (phase.type === 'night_reporter_investigation') {
      this._handleNightReporterInvestigation(playerId, abilityId, targets);
      return;
    }

    this.nightActions[playerId] = { abilityId, targets };

    const player = this.players.get(playerId);
    if (player) {
      player.usedAbilities[abilityId] = true;
    }

    this.emit('ability:used_confirmation', playerId);

    if (this._allNightActionsSubmitted()) {
      this.phaseManager.advancePhase();
    }
  }

  handleAbilitySkip(playerId) {
    const phase = this.phaseManager.getPhase();

    if (phase.type === 'night_reporter_investigation') {
      // 기자가 조사를 건너뜀
      this.nightDeathReporter = null;
      this.phaseManager.advancePhase();
      return;
    }

    this.nightActions[playerId] = { abilityId: 'skip', targets: [] };

    if (this._allNightActionsSubmitted()) {
      this.phaseManager.advancePhase();
    }
  }

  _allNightActionsSubmitted() {
    const abilityPlayers = Array.from(this.players.values())
      .filter(p => p.isAlive && this._hasNightAbility(p));

    // 투표 사망 기자도 포함
    if (this.pendingReporterInvestigation) {
      const reporter = this.players.get(this.pendingReporterInvestigation);
      if (reporter && !this.nightActions[reporter.playerId]) {
        return false; // 기자가 아직 행동 안 했으면 대기
      }
    }

    return abilityPlayers.every(p => this.nightActions[p.playerId]);
  }

  _hasNightAbility(player) {
    // 이주민 헌신 → 순경 조사 1회
    if (player.role === RoleId.IMMIGRANT && player.immigrantCommitted
        && !player.usedAbilities['immigrant_investigate']) {
      return true;
    }

    const role = player.displayRole || player.role;
    const meta = ROLE_META[role];
    if (!meta) return false;

    return meta.abilities.some(a => {
      if (a.timing !== 'night') return false;
      if (a.frequency === 'once_per_game' && player.usedAbilities[a.id]) return false;
      return true;
    });
  }

  // ══════════════════════════════════════════════════════
  //  밤 해결 (AbilityResolver 사용)
  // ══════════════════════════════════════════════════════

  _resolveNight() {
    const resolver = new AbilityResolver(this.players, this.nightActions, {
      lastVoteDeath: this.lastVoteDeath,
    });

    const result = resolver.resolve();

    // 사망 로그 기록
    for (const death of result.deaths) {
      this.deathLog.push({
        playerId: death.playerId,
        playerName: death.playerName,
        roundNumber: this.phaseManager.getRoundNumber(),
        cause: death.cause,
        phase: 'night_abilities',
      });
    }

    // 개별 능력 결과 전송
    for (const [playerId, abilityResult] of result.playerResults) {
      this.emit('ability:result', playerId, abilityResult);
    }

    // 침묵 알림
    if (result.silencedPlayers.length > 0) {
      this.emit('silence:applied', result.silencedPlayers);
    }

    // 밤 사망 기자 체크
    const reporterDeath = result.deaths.find(d => {
      const p = this.players.get(d.playerId);
      return p?.role === RoleId.REPORTER;
    });

    if (reporterDeath) {
      // 밤 사망 기자 → 기자 조사 페이즈로
      this.nightDeathReporter = reporterDeath.playerId;
      this.cachedNightResult = result;

      // 먼저 결과 발표 (기자 조사 결과는 나중에 추가)
      this.emit('dawn:results', {
        deaths: result.deaths.map(d => ({
          playerId: d.playerId,
          playerName: d.playerName,
          cause: d.causeDescription,
        })),
        saved: result.saved,
        silencedPlayers: result.silencedPlayers,
      });

      // 승리 조건 체크
      const winCheck = this.winChecker.check(this.players);
      if (winCheck.gameOver) {
        this._endGame(winCheck.winner, winCheck.reason);
        return;
      }

      // 기자 조사 페이즈
      this.phaseManager.transitionTo('night_reporter_investigation');
      return;
    }

    // 정상 흐름: 결과 발송 → 승리 체크 → 새벽
    this._proceedToDawn(result);
  }

  _proceedToDawn(nightResult) {
    // 결과 발송
    this.emit('dawn:results', {
      deaths: nightResult.deaths.map(d => ({
        playerId: d.playerId,
        playerName: d.playerName,
        cause: d.causeDescription,
      })),
      saved: nightResult.saved,
      silencedPlayers: nightResult.silencedPlayers,
      reporterResult: this.reporterInvestigationResult || null,
    });

    // 플레이어 리스트 업데이트
    this.emit('player_list_updated');

    // 승리 조건 체크
    const winCheck = this.winChecker.check(this.players);
    if (winCheck.gameOver) {
      this._endGame(winCheck.winner, winCheck.reason);
      return;
    }

    // 투표 사망 기자 결과도 보냄 (밤에 조사한 경우)
    if (this.pendingReporterInvestigation && this.nightActions[this.pendingReporterInvestigation]) {
      // 이미 AbilityResolver에서 처리됨
    }
    this.pendingReporterInvestigation = null;
    this.reporterInvestigationResult = null;

    // 새벽 표시
    this.phaseManager.transitionTo('dawn_reveal');
  }

  // 밤 사망 기자 조사 처리
  _handleNightReporterInvestigation(playerId, abilityId, targets) {
    if (abilityId !== 'reporter_investigate') return;

    const targetId = targets[0];
    const target = this.players.get(targetId);
    if (!target) return;

    const result = {
      abilityId: 'reporter_investigate',
      targetPlayerId: targetId,
      targetName: target.name,
      result: target.team,
      message: `[취재 결과] ${target.name}의 소속: ${target.team === 'mafia' ? '마피아' : '시민'}`,
    };

    this.reporterInvestigationResult = result;
    this.emit('ability:result', playerId, result);

    // 기자 조사 완료 → 새벽으로
    this.nightDeathReporter = null;
    this.phaseManager.advancePhase();
  }

  _completeReporterInvestigation() {
    // 기자 조사 페이즈 종료 (타임아웃 or 완료)
    this.nightDeathReporter = null;

    // 새벽으로
    this.phaseManager.transitionTo('dawn_reveal');
  }

  _startNewDay() {
    const round = this.phaseManager.getRoundNumber() + 1;
    this.phaseManager.transitionTo('day_discussion', round);
  }

  // ══════════════════════════════════════════════════════
  //  게임 종료
  // ══════════════════════════════════════════════════════

  _endGame(winner, reason) {
    this.phaseManager.transitionTo('game_over');

    const playerResults = Array.from(this.players.values()).map(p => {
      let points = 0;
      const won = p.team === winner;
      if (won) points += 2;

      // 이주민 점수
      if (p.role === RoleId.IMMIGRANT && !p.immigrantCommitted) {
        if (p.isAlive) points = 3;
        else points = -1;
      }

      p.sessionScore += points;

      return {
        playerId: p.playerId,
        playerName: p.name,
        role: p.role,
        displayRole: p.displayRole,
        team: p.team,
        survived: p.isAlive,
        pointsEarned: points,
      };
    });

    const gameResult = {
      gameId: this.gameId,
      winner,
      winReason: reason,
      rounds: this.phaseManager.getRoundNumber(),
      playerResults,
    };

    this.room.gameHistory.push(gameResult);
    this.emit('game:over', { winner, reason, gameResult });
  }

  // ══════════════════════════════════════════════════════
  //  호스트 컨트롤
  // ══════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════
  //  스킵 투표
  // ══════════════════════════════════════════════════════

  handleSkipVote(playerId) {
    const phase = this.phaseManager.getPhase();
    // 스킵 가능한 페이즈: 낮 토론, 최후 변론, 새벽 발표
    const skippablePhases = ['day_discussion', 'day_last_words', 'dawn_reveal'];
    if (!skippablePhases.includes(phase.type)) return;

    this.skipVotes.add(playerId);

    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    const needed = Math.ceil(alivePlayers.length / 2); // 과반수
    const current = this.skipVotes.size;

    this.emit('skip:count_update', { current, needed, total: alivePlayers.length });

    if (current >= needed) {
      this.skipVotes.clear();
      this.emit('skip:approved');
      this.phaseManager.advancePhase();
    }
  }

  advancePhase() {
    this.skipVotes.clear();
    this.phaseManager.advancePhase();
  }

  pauseTimer() {
    this.phaseManager.pauseTimer();
    this.emit('phase:timer_paused');
  }

  resumeTimer() {
    this.phaseManager.resumeTimer();
    this.emit('phase:timer_resumed', this.phaseManager.getPhase().timerRemaining);
  }

  forceEndGame(winner) {
    this._endGame(winner || 'citizen', '호스트에 의해 게임이 종료되었습니다.');
  }

  // ══════════════════════════════════════════════════════
  //  유틸리티
  // ══════════════════════════════════════════════════════

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  destroy() {
    this.phaseManager.destroy();
    this.removeAllListeners();
  }
}
