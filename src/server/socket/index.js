import { GameEngine } from '../game/GameEngine.js';
import { generateQRCode } from '../utils/qr.js';
import { ROLE_META, RoleId } from '../../shared/constants/roles.js';

const socketMeta = new Map();

export function setupSocketHandlers(io, gameManager, localIP, port) {
  io.on('connection', (socket) => {
    console.log(`[연결] ${socket.id}`);

    // === 방 생성 (호스트) ===
    socket.on('room:create', async (config) => {
      try {
        const room = gameManager.createRoom(socket.id, config ?? undefined);
        const playerUrl = `http://${localIP}:${port}/player?room=${room.roomCode}`;
        const qrCodeDataUrl = await generateQRCode(playerUrl);

        socketMeta.set(socket.id, { clientType: 'host', roomId: room.roomId });
        socket.join(`room:${room.roomCode}`);
        socket.join(`room:${room.roomCode}:host`);

        socket.emit('room:created', {
          roomCode: room.roomCode,
          roomId: room.roomId,
          qrCodeDataUrl,
        });

        console.log(`[방 생성] ${room.roomCode}`);
      } catch (err) {
        socket.emit('error', { code: 'ROOM_CREATE_FAILED', message: err.message });
      }
    });

    // === 플레이어 참여 ===
    socket.on('lobby:join', async (data) => {
      try {
        const room = gameManager.getRoomByCode(data.roomCode);
        if (!room) {
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '방을 찾을 수 없습니다.' });
          return;
        }
        if (room.state !== 'lobby') {
          // 게임 진행 중에는 새 플레이어 참여 불가 (재접속은 player:reconnect 사용)
          socket.emit('error', { code: 'GAME_IN_PROGRESS', message: '이미 게임이 진행 중입니다. 재접속을 시도해주세요.' });
          return;
        }

        const player = room.addPlayer(socket.id, data.playerName);
        socketMeta.set(socket.id, { clientType: 'player', roomId: room.roomId, playerId: player.playerId });

        socket.join(`room:${room.roomCode}`);
        socket.join(`room:${room.roomCode}:players`);
        socket.join(`room:${room.roomCode}:player:${player.playerId}`);

        socket.emit('connection:registered', {
          success: true,
          playerId: player.playerId,
          roomCode: room.roomCode,
        });

        io.to(`room:${room.roomCode}`).emit('room:player_joined', {
          playerId: player.playerId,
          name: player.name,
          isAlive: true,
          isConnected: true,
          isSilenced: false,
        });
        io.to(`room:${room.roomCode}`).emit('room:player_list', room.getPublicPlayerList());

        console.log(`[참여] ${player.name} → ${room.roomCode} (${room.players.size}명)`);
      } catch (err) {
        socket.emit('error', { code: 'JOIN_FAILED', message: err.message });
      }
    });

    // === 플레이어 재접속 ===
    socket.on('player:reconnect', (data) => {
      try {
        const room = gameManager.getRoomByCode(data.roomCode);
        if (!room) {
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '방을 찾을 수 없습니다.' });
          return;
        }

        const player = room.players.get(data.playerId);
        if (!player) {
          socket.emit('error', { code: 'PLAYER_NOT_FOUND', message: '플레이어를 찾을 수 없습니다.' });
          return;
        }

        // 소켓 정보 갱신
        const oldSocketId = player.socketId;
        player.socketId = socket.id;
        player.isConnected = true;
        socketMeta.delete(oldSocketId);
        socketMeta.set(socket.id, { clientType: 'player', roomId: room.roomId, playerId: player.playerId });

        // 소켓 룸 재가입
        socket.join(`room:${room.roomCode}`);
        socket.join(`room:${room.roomCode}:players`);
        socket.join(`room:${room.roomCode}:player:${player.playerId}`);

        // 기본 정보 전송
        socket.emit('reconnect:success', {
          playerId: player.playerId,
          roomCode: room.roomCode,
          playerName: player.name,
          state: room.state,
        });

        // 게임 진행 중이면 현재 상태 재전송
        if (room.state === 'playing' && room.gameEngine) {
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

          if (player.team === 'mafia') {
            const mafiaMembers = Array.from(room.players.values())
              .filter(p => p.team === 'mafia' && p.playerId !== player.playerId)
              .map(p => ({ playerId: p.playerId, name: p.name }));
            roleData.teamMembers = mafiaMembers;
          }

          socket.emit('game:started');
          socket.emit('game:role_assigned', roleData);
          socket.emit('phase:changed', room.gameEngine.phaseManager.getPhase());
        }

        // 플레이어 리스트 업데이트 (전체 방에)
        io.to(`room:${room.roomCode}`).emit('room:player_list', room.getPublicPlayerList());

        console.log(`[재접속] ${player.name} → ${room.roomCode}`);
      } catch (err) {
        socket.emit('error', { code: 'RECONNECT_FAILED', message: err.message });
      }
    });

    // === 모니터 참여 ===
    socket.on('connection:register', async (data) => {
      if (data.clientType === 'monitor' && data.roomCode) {
        const room = gameManager.getRoomByCode(data.roomCode);
        if (!room) {
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '방을 찾을 수 없습니다.' });
          return;
        }

        room.monitorSocketIds.add(socket.id);
        socketMeta.set(socket.id, { clientType: 'monitor', roomId: room.roomId });

        socket.join(`room:${room.roomCode}`);
        socket.join(`room:${room.roomCode}:monitor`);

        const playerUrl = `http://${localIP}:${port}/player?room=${room.roomCode}`;
        const qrCodeDataUrl = await generateQRCode(playerUrl);

        socket.emit('connection:registered', { success: true, roomCode: room.roomCode });
        socket.emit('monitor:qr_code', qrCodeDataUrl);
        socket.emit('room:player_list', room.getPublicPlayerList());
        socket.emit('room:info', room.getInfo());

        console.log(`[모니터] ${socket.id} → ${room.roomCode}`);
      }
    });

    // === 설정 변경 (호스트) ===
    socket.on('room:update_config', (config) => {
      const room = _getRoom(socket);
      if (!room) return;
      room.updateConfig(config);
      io.to(`room:${room.roomCode}`).emit('room:config_updated', room.config);
    });

    // === 플레이어 퇴장 (호스트) ===
    socket.on('room:kick_player', (playerId) => {
      const room = _getRoom(socket);
      if (!room) return;

      const player = room.players.get(playerId);
      if (!player) return;

      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit('error', { code: 'KICKED', message: '호스트에 의해 퇴장되었습니다.' });
        playerSocket.leave(`room:${room.roomCode}`);
        socketMeta.delete(player.socketId);
      }

      room.removePlayer(playerId);
      io.to(`room:${room.roomCode}`).emit('room:player_left', playerId);
      io.to(`room:${room.roomCode}`).emit('room:player_list', room.getPublicPlayerList());
    });

    // === 게임 시작 (호스트) ===
    socket.on('host:start_game', () => {
      const room = _getRoom(socket);
      if (!room) return;

      const check = room.canStart();
      if (!check.ok) {
        socket.emit('error', { code: 'CANNOT_START', message: check.reason });
        return;
      }

      room.state = 'playing';
      const engine = new GameEngine(room);
      room.gameEngine = engine;

      _bindEngineEvents(io, room, engine);

      io.to(`room:${room.roomCode}`).emit('game:started');
      engine.start();
      console.log(`[게임 시작] ${room.roomCode} (${room.players.size}명)`);
    });

    // === 호스트 컨트롤 ===
    socket.on('host:advance_phase', () => {
      const room = _getRoom(socket);
      room?.gameEngine?.advancePhase();
    });

    socket.on('host:pause_timer', () => {
      const room = _getRoom(socket);
      room?.gameEngine?.pauseTimer();
    });

    socket.on('host:resume_timer', () => {
      const room = _getRoom(socket);
      room?.gameEngine?.resumeTimer();
    });

    socket.on('host:boss_double_vote', () => {
      const room = _getRoom(socket);
      if (!room || !room.gameEngine) return;
      const boss = Array.from(room.players.values()).find(p => p.role === RoleId.BOSS && p.isAlive);
      if (boss) {
        room.gameEngine.handleDoubleVote(boss.playerId);
        socket.emit('host:boss_double_vote_ok');
      }
    });

    socket.on('host:end_game', (winner) => {
      const room = _getRoom(socket);
      room?.gameEngine?.forceEndGame(winner);
    });

    socket.on('host:next_game', () => {
      const room = _getRoom(socket);
      if (!room) return;
      if (room.gameEngine) {
        room.gameEngine.destroy();
      }
      room.resetForNewGame();
      io.to(`room:${room.roomCode}`).emit('game:reset_to_lobby');
      io.to(`room:${room.roomCode}`).emit('room:player_list', room.getPublicPlayerList());
      io.to(`room:${room.roomCode}`).emit('room:info', room.getInfo());
    });

    // === 투표 ===
    socket.on('vote:cast', (data) => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      room?.gameEngine?.handleVote(meta.playerId, data.targetPlayerId);
    });

    // === 더블 투표 ===
    socket.on('double_vote:activate', (data) => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      room?.gameEngine?.handleDoubleVote(meta.playerId);
    });

    // === 스킵 투표 ===
    socket.on('skip:vote', () => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      room?.gameEngine?.handleSkipVote(meta.playerId);
    });

    // === 능력 사용 ===
    socket.on('ability:use', (data) => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      room?.gameEngine?.handleAbility(meta.playerId, data.abilityId, data.targets);
    });

    socket.on('ability:skip', () => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      room?.gameEngine?.handleAbilitySkip(meta.playerId);
    });

    // === 마피아 채팅 (밤 시간만) ===
    socket.on('mafia:chat', (data) => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      if (!room || !room.gameEngine) return;

      const player = room.players.get(meta.playerId);
      if (!player || player.team !== 'mafia') return;

      // 밤 페이즈에서만 허용
      const phase = room.gameEngine.phaseManager.getPhase();
      if (!phase.type.startsWith('night')) return;

      // 같은 방 마피아 전원에게 전송
      const roomKey = `room:${room.roomCode}`;
      for (const p of room.players.values()) {
        if (p.team === 'mafia') {
          io.to(`${roomKey}:player:${p.playerId}`).emit('mafia:chat_message', {
            senderName: player.name,
            senderId: player.playerId,
            message: data.message,
          });
        }
      }
    });

    // === 이주민 헌신 ===
    socket.on('immigrant:commit', () => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.playerId) return;
      const room = gameManager.getRoom(meta.roomId);
      const player = room?.players.get(meta.playerId);
      if (player && player.role === RoleId.IMMIGRANT) {
        player.immigrantCommitted = true;
        socket.emit('immigrant:committed', { success: true });
        console.log(`[이주민 헌신] ${player.name}`);
      }
    });

    // === 연결 해제 ===
    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket.id);
      if (!meta?.roomId) {
        socketMeta.delete(socket.id);
        return;
      }

      const room = gameManager.getRoom(meta.roomId);
      if (!room) {
        socketMeta.delete(socket.id);
        return;
      }

      if (meta.clientType === 'player') {
        const player = room.disconnectPlayer(socket.id);
        if (player) {
          io.to(`room:${room.roomCode}`).emit('room:player_list', room.getPublicPlayerList());
          console.log(`[연결 끊김] ${player.name} (${room.roomCode})`);
        }
      } else if (meta.clientType === 'monitor') {
        room.monitorSocketIds.delete(socket.id);
      }

      socketMeta.delete(socket.id);
    });

    // 헬퍼
    function _getRoom(sock) {
      const meta = socketMeta.get(sock.id);
      if (!meta?.roomId) return null;
      return gameManager.getRoom(meta.roomId);
    }
  });
}

// ══════════════════════════════════════════════════════
//  GameEngine 이벤트 → Socket.IO 브로드캐스트
// ══════════════════════════════════════════════════════

function _bindEngineEvents(io, room, engine) {
  const roomKey = `room:${room.roomCode}`;

  engine.on('phase:changed', (phase) => {
    io.to(roomKey).emit('phase:changed', phase);
  });

  engine.on('phase:timer_tick', (remaining) => {
    io.to(roomKey).emit('phase:timer_tick', remaining);
  });

  engine.on('phase:timer_paused', () => {
    io.to(roomKey).emit('phase:timer_paused');
  });

  engine.on('phase:timer_resumed', (remaining) => {
    io.to(roomKey).emit('phase:timer_resumed', remaining);
  });

  engine.on('role:assigned', (playerId, roleData) => {
    io.to(`${roomKey}:player:${playerId}`).emit('game:role_assigned', roleData);
  });

  engine.on('vote:opened', (data) => {
    io.to(roomKey).emit('vote:opened', data);
  });

  engine.on('vote:count_update', (data) => {
    io.to(roomKey).emit('vote:count_update', data);
  });

  engine.on('vote:result', (data) => {
    io.to(roomKey).emit('vote:result', data);
    io.to(roomKey).emit('room:player_list', room.getPublicPlayerList());
  });

  engine.on('ability:used_confirmation', (playerId) => {
    io.to(`${roomKey}:player:${playerId}`).emit('ability:used_confirmation');
  });

  // ── 능력 결과 (개인 전송) ──
  engine.on('ability:result', (playerId, result) => {
    io.to(`${roomKey}:player:${playerId}`).emit('ability:result', result);
  });

  // ── 침묵 알림 ──
  engine.on('silence:applied', (silencedPlayers) => {
    // 침묵된 플레이어에게 개인 알림
    for (const sp of silencedPlayers) {
      io.to(`${roomKey}:player:${sp.playerId}`).emit('silence:you_are_silenced');
    }
    // 전체에게 침묵된 플레이어 목록
    io.to(roomKey).emit('silence:list', silencedPlayers);
  });

  // ── 플레이어 리스트 업데이트 (밤 사망 반영) ──
  engine.on('player_list_updated', () => {
    io.to(roomKey).emit('room:player_list', room.getPublicPlayerList());
  });

  engine.on('dawn:results', (data) => {
    io.to(roomKey).emit('dawn:results', data);
    io.to(roomKey).emit('room:player_list', room.getPublicPlayerList());
  });

  engine.on('game:over', (data) => {
    io.to(roomKey).emit('game:over', data);
    io.to(roomKey).emit('score:update', room.getSessionScores());
  });

  // ── 스킵 투표 ──
  engine.on('skip:count_update', (data) => {
    io.to(roomKey).emit('skip:count_update', data);
  });

  engine.on('skip:approved', () => {
    io.to(roomKey).emit('skip:approved');
  });

  // ── 원정 결과 (호스트에게만) ──
  engine.on('expedition:result', (expeditionTargets) => {
    io.to(`${roomKey}:host`).emit('host:expedition_result', {
      targets: expeditionTargets,
    });
  });

  engine.on('night:started', () => {
    _sendAbilityPrompts(io, room, engine);
  });

  engine.on('reporter:investigate', (reporterPlayerId) => {
    const targets = Array.from(room.players.values())
      .filter(p => p.playerId !== reporterPlayerId)
      .map(p => ({ playerId: p.playerId, name: p.name }));

    io.to(`${roomKey}:player:${reporterPlayerId}`).emit('ability:prompt', {
      abilityId: 'reporter_investigate',
      description: '사망 시 취재: 한 명의 정확한 소속을 확인합니다.',
      targetCount: 1,
      eligibleTargets: targets,
      isOptional: false,
    });
  });
}

// ══════════════════════════════════════════════════════
//  밤 능력 프롬프트 전송
// ══════════════════════════════════════════════════════

function _sendAbilityPrompts(io, room, engine) {
  const roomKey = `room:${room.roomCode}`;

  for (const player of room.players.values()) {
    if (!player.isAlive) continue;

    // ── 이주민 헌신 후 순경 조사 ──
    if (player.role === RoleId.IMMIGRANT && player.immigrantCommitted
        && !player.usedAbilities['immigrant_investigate']) {
      const eligibleTargets = Array.from(room.players.values())
        .filter(p => p.isAlive && p.playerId !== player.playerId)
        .map(p => ({ playerId: p.playerId, name: p.name }));

      io.to(`${roomKey}:player:${player.playerId}`).emit('ability:prompt', {
        abilityId: 'immigrant_investigate',
        description: '헌신 보상: 한 명의 소속을 확인합니다. (순경 능력)',
        targetCount: 1,
        eligibleTargets,
        isOptional: true,
      });
      continue;
    }

    const role = player.displayRole || player.role;
    const meta = ROLE_META[role];
    if (!meta) continue;

    const nightAbilities = meta.abilities.filter(a => {
      if (a.timing !== 'night') return false;
      if (a.frequency === 'once_per_game' && player.usedAbilities[a.id]) return false;
      return true;
    });

    for (const ability of nightAbilities) {
      let eligibleTargets;

      // 의사: 죽은 플레이어 대상 (기자 제외)
      if (ability.id === 'doctor_revive') {
        eligibleTargets = Array.from(room.players.values())
          .filter(p => !p.isAlive && p.role !== RoleId.REPORTER)
          .map(p => ({ playerId: p.playerId, name: p.name }));
        if (eligibleTargets.length === 0) continue; // 부활 대상 없으면 스킵
      } else {
        eligibleTargets = Array.from(room.players.values())
          .filter(p => p.isAlive && p.playerId !== player.playerId)
          .map(p => ({ playerId: p.playerId, name: p.name }));
      }

      io.to(`${roomKey}:player:${player.playerId}`).emit('ability:prompt', {
        abilityId: ability.id,
        description: ability.description,
        targetCount: ability.targetCount,
        eligibleTargets,
        isOptional: ability.frequency === 'once_per_game',
      });
    }
  }

  // ── 투표 사망 기자 조사 (밤 중에 처리) ──
  if (engine.pendingReporterInvestigation) {
    const reporterId = engine.pendingReporterInvestigation;
    const reporter = room.players.get(reporterId);
    if (reporter) {
      const targets = Array.from(room.players.values())
        .filter(p => p.playerId !== reporterId)
        .map(p => ({ playerId: p.playerId, name: p.name }));

      io.to(`${roomKey}:player:${reporterId}`).emit('ability:prompt', {
        abilityId: 'reporter_investigate',
        description: '사망 시 취재: 한 명의 정확한 소속을 확인합니다.',
        targetCount: 1,
        eligibleTargets: targets,
        isOptional: false,
      });
    }
  }
}
