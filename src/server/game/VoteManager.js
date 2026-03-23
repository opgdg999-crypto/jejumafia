import { EventEmitter } from 'events';

export class VoteManager extends EventEmitter {
  constructor() {
    super();
    this.votes = new Map(); // voterId → targetId
    this.doubleVoters = new Set();
    this.eligibleTargets = [];
    this.isKillSaveVote = false;
  }

  reset() {
    this.votes.clear();
    this.doubleVoters.clear();
    this.eligibleTargets = [];
    this.isKillSaveVote = false;
  }

  openVote(targets, isKillSave = false) {
    this.votes.clear();
    this.doubleVoters.clear();
    this.eligibleTargets = targets;
    this.isKillSaveVote = isKillSave;
  }

  activateDoubleVote(playerId) {
    this.doubleVoters.add(playerId);
  }

  castVote(voterId, targetId) {
    if (!this.isKillSaveVote && !this.eligibleTargets.includes(targetId)) {
      return false;
    }
    this.votes.set(voterId, targetId);
    return true;
  }

  castKillSaveVote(voterId, vote) {
    this.votes.set(voterId, vote);
    return true;
  }

  getVoteCounts() {
    const counts = {};

    if (this.isKillSaveVote) {
      counts['kill'] = 0;
      counts['save'] = 0;
    } else {
      for (const target of this.eligibleTargets) {
        counts[target] = 0;
      }
    }

    for (const [voterId, targetId] of this.votes) {
      if (counts[targetId] !== undefined) {
        counts[targetId] += this.doubleVoters.has(voterId) ? 2 : 1;
      }
    }

    return counts;
  }

  getVoteStatus(totalVoters) {
    return {
      counts: this.getVoteCounts(),
      totalVoted: this.votes.size,
      totalVoters,
    };
  }

  hasEveryoneVoted(voters) {
    return voters.every(p => this.votes.has(p.playerId));
  }

  resolve(players) {
    const counts = this.getVoteCounts();

    if (this.isKillSaveVote) {
      return this._resolveKillSave(counts);
    }

    return this._resolveStandardVote(counts, players);
  }

  _resolveKillSave(counts) {
    const killCount = counts['kill'] || 0;
    const saveCount = counts['save'] || 0;

    // 동률 시 살림
    if (killCount <= saveCount) {
      return { outcome: 'save', counts };
    }

    return {
      outcome: 'kill',
      eliminated: this.eligibleTargets[0],
      counts,
    };
  }

  _resolveStandardVote(counts, players) {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0 || sorted[0][1] === 0) {
      return { outcome: 'save', counts };
    }

    const maxVotes = sorted[0][1];
    const tied = sorted.filter(([, v]) => v === maxVotes);

    if (tied.length > 1) {
      return {
        outcome: 'tie',
        counts,
        tiedPlayers: tied.map(([id]) => id),
      };
    }

    // 최다 득표 1명 → 죽여/살려 투표로 이동
    const targetId = sorted[0][0];
    const player = players.get(targetId);
    return {
      outcome: 'kill',
      eliminated: targetId,
      eliminatedName: player?.name,
      counts,
    };
  }
}
