import { v4 as uuidv4 } from 'uuid';
import { GameRoom } from './GameRoom.js';
import { MAX_ROOMS } from '../../shared/constants/game-rules.js';

export class GameManager {
  constructor() {
    this.rooms = new Map();
    this.roomsByCode = new Map();
  }

  createRoom(hostSocketId, config) {
    if (this.rooms.size >= MAX_ROOMS) {
      throw new Error(`최대 ${MAX_ROOMS}개의 방만 생성할 수 있습니다.`);
    }

    const roomId = uuidv4();
    const roomCode = this._generateRoomCode();
    const room = new GameRoom(roomId, roomCode, hostSocketId, config);
    this.rooms.set(roomId, room);
    this.roomsByCode.set(roomCode, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code) {
    return this.roomsByCode.get(code.toUpperCase());
  }

  removeRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      this.roomsByCode.delete(room.roomCode);
      this.rooms.delete(roomId);
    }
  }

  getRoomCount() {
    return this.rooms.size;
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.roomsByCode.has(code));
    return code;
  }
}
