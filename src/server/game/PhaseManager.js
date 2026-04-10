import { EventEmitter } from 'events';
import { getDayTimer } from '../../shared/constants/game-rules.js';

export class PhaseManager extends EventEmitter {
  constructor(timerConfig) {
    super();
    this.timerConfig = timerConfig;
    this.timerInterval = null;
    this.currentPhase = {
      type: 'lobby',
      roundNumber: 0,
      timerDuration: 0,
      timerRemaining: 0,
      timerRunning: false,
    };
  }

  getPhase() {
    return { ...this.currentPhase };
  }

  getRoundNumber() {
    return this.currentPhase.roundNumber;
  }

  startGame() {
    this.transitionTo('night_abilities', 1);
  }

  transitionTo(type, roundNumber) {
    this._stopTimer();

    const round = roundNumber ?? this.currentPhase.roundNumber;
    const duration = this._getTimerDuration(type, round);

    this.currentPhase = {
      type,
      roundNumber: round,
      timerDuration: duration,
      timerRemaining: duration,
      timerRunning: false,
    };

    this.emit('phase:changed', this.getPhase());

    if (duration > 0) {
      this._startTimer();
    }
  }

  transitionToVote(targets, isRevote = false) {
    this._stopTimer();

    const type = isRevote ? 'day_vote_revote' : 'day_vote';
    const duration = this.timerConfig.vote;

    this.currentPhase = {
      type,
      roundNumber: this.currentPhase.roundNumber,
      timerDuration: duration,
      timerRemaining: duration,
      timerRunning: false,
      voteTargets: targets,
      isRevote,
    };

    this.emit('phase:changed', this.getPhase());
    this._startTimer();
  }

  transitionToKillSaveVote(targetPlayerId) {
    this._stopTimer();

    const duration = this.timerConfig.vote;

    this.currentPhase = {
      type: 'day_kill_save_vote',
      roundNumber: this.currentPhase.roundNumber,
      timerDuration: duration,
      timerRemaining: duration,
      timerRunning: false,
      voteTargets: [targetPlayerId],
    };

    this.emit('phase:changed', this.getPhase());
    this._startTimer();
  }

  advancePhase() {
    this._stopTimer();
    this.emit('phase:timer_expired', this.getPhase());
  }

  pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.currentPhase.timerRunning = false;
    }
  }

  resumeTimer() {
    if (!this.timerInterval && this.currentPhase.timerRemaining > 0) {
      this._startTimer();
    }
  }

  updateTimerConfig(config) {
    this.timerConfig = config;
  }

  _startTimer() {
    this.currentPhase.timerRunning = true;
    this.timerInterval = setInterval(() => {
      this.currentPhase.timerRemaining--;
      this.emit('phase:timer_tick', this.currentPhase.timerRemaining);

      if (this.currentPhase.timerRemaining <= 0) {
        this._stopTimer();
        this.emit('phase:timer_expired', this.getPhase());
      }
    }, 1000);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.currentPhase.timerRunning = false;
    }
  }

  _getTimerDuration(type, roundNumber) {
    switch (type) {
      case 'day_discussion':
        return getDayTimer(roundNumber, this.timerConfig);
      case 'day_vote':
      case 'day_vote_revote':
      case 'day_kill_save_vote':
        return this.timerConfig.vote;
      case 'day_last_words':
        return this.timerConfig.lastWords;
      case 'night_abilities':
        return this.timerConfig.night;
      case 'night_reporter_investigation':
        return 30; // 기자 조사 30초
      case 'dawn_reveal':
        return this.timerConfig.dawnReveal || 0; // 0이면 호스트 수동 진행
      default:
        return 0;
    }
  }

  destroy() {
    this._stopTimer();
    this.removeAllListeners();
  }
}
