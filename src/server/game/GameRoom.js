import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_TIMERS, MIN_PLAYERS, MAX_PLAYERS } from '../../shared/constants/game-rules.js';
import { RoleId } from '../../shared/constants/roles.js';

function getDefaultRolePool() {
  return Object.values(RoleId).map(roleId => ({ roleId, enabled: true }));
}

export class GameRoom {
  constructor(roomId, roomCode, hostSocketId, config) {
    this.roomId = roomId;
    this.roomCode = roomCode;
    this.hostSocketId = hostSocketId;
    this.monitorSocketIds = new Set();
    this.players = new Map();
    this.state = 'lobby'; // lobby | playing | finished
    this.gameEngine = null;
    this.gameHistory = [];

    this.config = {
      maxPlayers: config?.maxPlayers ?? MAX_PLAYERS,
      timers: { ...DEFAULT_TIMERS, ...(config?.timers || {}) },
      rolePool: config?.rolePool ?? getDefaultRolePool(),
      assignmentMode: config?.assignmentMode ?? 'auto',
      mafiaCount: config?.mafiaCount ?? 'auto', // 'auto' 또는 숫자 (2~4)
    };
  }

  addPlayer(socketId, name, existingPlayerId) {
    if (this.players.size >= this.config.maxPlayers) {
      throw new Error('방이 가득 찼습니다.');
    }

    if (existingPlayerId) {
      const existing = this.players.get(existingPlayerId);
      if (existing) {
        existing.socketId = socketId;
        existing.isConnected = true;
        return existing;
      }
    }

    const nameExists = Array.from(this.players.values()).some(p => p.name === name);
    if (nameExists) {
      throw new Error('이미 사용 중인 이름입니다.');
    }

    const player = {
      playerId: uuidv4(),
      socketId,
      name,
      role: null,
      displayRole: null,
      team: null,
      isAlive: true,
      isConnected: true,
      isSilenced: false,
      usedAbilities: {},
      immigrantCommitted: false,
      sessionScore: 0,
    };

    this.players.set(player.playerId, player);
    return player;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  disconnectPlayer(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.isConnected = false;
        return player;
      }
    }
    return undefined;
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return undefined;
  }

  getPublicPlayerList() {
    return Array.from(this.players.values()).map(p => ({
      playerId: p.playerId,
      name: p.name,
      isAlive: p.isAlive,
      isConnected: p.isConnected,
      isSilenced: p.isSilenced,
    }));
  }

  getInfo() {
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      config: this.config,
      state: this.state,
      playerCount: this.players.size,
      maxPlayers: this.config.maxPlayers,
    };
  }

  canStart() {
    if (this.state !== 'lobby') {
      return { ok: false, reason: '이미 게임이 진행 중입니다.' };
    }
    if (this.players.size < MIN_PLAYERS) {
      return { ok: false, reason: `최소 ${MIN_PLAYERS}명이 필요합니다. (현재 ${this.players.size}명)` };
    }
    return { ok: true };
  }

  updateConfig(partial) {
    if (partial.maxPlayers !== undefined) {
      this.config.maxPlayers = Math.min(Math.max(partial.maxPlayers, MIN_PLAYERS), MAX_PLAYERS);
    }
    if (partial.timers) {
      this.config.timers = { ...this.config.timers, ...partial.timers };
    }
    if (partial.rolePool) {
      this.config.rolePool = partial.rolePool;
    }
    if (partial.assignmentMode) {
      this.config.assignmentMode = partial.assignmentMode;
    }
    if (partial.mafiaCount !== undefined) {
      if (partial.mafiaCount === 'auto') {
        this.config.mafiaCount = 'auto';
      } else {
        const count = parseInt(partial.mafiaCount);
        if (count >= 2 && count <= 4) {
          this.config.mafiaCount = count;
        }
      }
    }
  }

  getSessionScores() {
    return Array.from(this.players.values()).map(player => ({
      playerId: player.playerId,
      playerName: player.name,
      games: [],
      totalPoints: player.sessionScore,
    }));
  }

  resetForNewGame() {
    for (const player of this.players.values()) {
      player.role = null;
      player.displayRole = null;
      player.team = null;
      player.isAlive = true;
      player.isSilenced = false;
      player.usedAbilities = {};
      player.immigrantCommitted = false;
    }
    this.state = 'lobby';
    this.gameEngine = null;
  }
}
