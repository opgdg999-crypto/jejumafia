// 역할 ID 상수
export const RoleId = {
  // 마피아
  BOSS: 'boss',
  WIND_DECEIVER: 'wind_deceiver',
  SMUGGLER: 'smuggler',
  AGITATOR: 'agitator',
  ASSASSIN: 'assassin',
  GOBLIN: 'goblin',
  SHIELD: 'shield',
  MAFIA_SHAMAN: 'mafia_shaman',
  // 시민
  DOCTOR: 'doctor',
  POLICE: 'police',
  SOCIALITE: 'socialite',
  COAST_GUARD: 'coast_guard',
  PROTECTOR_GRANDMA: 'protector_grandma',
  BLOCKER_GRANDMA: 'blocker_grandma',
  DOUBLE_VOTER: 'double_voter',
  FISHERMAN: 'fisherman',
  VILLAGE_HEAD: 'village_head',
  MONGSENGI: 'mongsengi',
  IDLER: 'idler',
  COUNCIL_MEMBER: 'council_member',
  REPORTER: 'reporter',
  FORTUNE_TELLER: 'fortune_teller',
  IMMIGRANT: 'immigrant',
};

export const RoleTeam = {
  MAFIA: 'mafia',
  CITIZEN: 'citizen',
};

// 역할 메타데이터
export const ROLE_META = {
  // === 마피아 ===
  [RoleId.BOSS]: {
    id: RoleId.BOSS,
    nameKo: '돌하르방 보스',
    team: RoleTeam.MAFIA,
    description: '매일 밤 한 명을 사살합니다. 게임에 없는 시민 직업 하나를 알고 시작합니다. 보스가 죽으면 마피아 팀이 패배합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'boss_kill', nameKo: '사살', description: '한 명을 선택해 사살합니다.',
      timing: 'night', frequency: 'every_night', targetCount: 1,
    }],
  },
  [RoleId.WIND_DECEIVER]: {
    id: RoleId.WIND_DECEIVER,
    nameKo: '제주 바람쟁이',
    team: RoleTeam.MAFIA,
    description: '매일 밤 한 명을 선택해, 조사 능력자일 경우 결과를 반대로 만듭니다.',
    minPlayers: 0,
    abilities: [{
      id: 'wind_deceive', nameKo: '바람', description: '한 명을 선택합니다. 조사 능력자라면 결과가 반전됩니다.',
      timing: 'night', frequency: 'every_night', targetCount: 1,
    }],
  },
  [RoleId.SMUGGLER]: {
    id: RoleId.SMUGGLER,
    nameKo: '감귤 밀수업자',
    team: RoleTeam.MAFIA,
    description: '조사 대상이 되면 시민으로 표시됩니다.',
    minPlayers: 0,
    abilities: [],
  },
  [RoleId.AGITATOR]: {
    id: RoleId.AGITATOR,
    nameKo: '선과장 선동꾼',
    team: RoleTeam.MAFIA,
    description: '한 게임에 한 번, 투표권을 2회 행사합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'agitator_double_vote', nameKo: '선동', description: '투표권을 2회 행사합니다.',
      timing: 'day_vote', frequency: 'once_per_game', targetCount: 0,
    }],
  },
  [RoleId.ASSASSIN]: {
    id: RoleId.ASSASSIN,
    nameKo: '돌하르방 암살자',
    team: RoleTeam.MAFIA,
    description: '한 게임에 한 번, 한 명을 사살합니다.',
    minPlayers: 12,
    abilities: [{
      id: 'assassin_kill', nameKo: '암살', description: '한 명을 선택해 사살합니다.',
      timing: 'night', frequency: 'once_per_game', targetCount: 1,
    }],
  },
  [RoleId.GOBLIN]: {
    id: RoleId.GOBLIN,
    nameKo: '제주 도깨비',
    team: RoleTeam.MAFIA,
    description: '한 게임에 한 번, 3명을 선택해 사회자에게 알립니다.',
    minPlayers: 0,
    abilities: [{
      id: 'goblin_expedition', nameKo: '원정', description: '3명을 선택해 사회자에게 알립니다.',
      timing: 'night', frequency: 'once_per_game', targetCount: 3,
    }],
  },
  [RoleId.SHIELD]: {
    id: RoleId.SHIELD,
    nameKo: '돌하르방 액막이',
    team: RoleTeam.MAFIA,
    description: '살아있는 동안, 보스가 조사 대상이 되면 시민으로 표시됩니다.',
    minPlayers: 0,
    abilities: [],
  },
  [RoleId.MAFIA_SHAMAN]: {
    id: RoleId.MAFIA_SHAMAN,
    nameKo: '제주 선무당',
    team: RoleTeam.MAFIA,
    description: '한 게임에 한 번, 한 명의 능력 사용을 막습니다.',
    minPlayers: 0,
    abilities: [{
      id: 'mafia_shaman_block', nameKo: '봉인', description: '한 명을 선택해 능력 사용을 막습니다.',
      timing: 'night', frequency: 'once_per_game', targetCount: 1,
    }],
  },

  // === 시민 ===
  [RoleId.DOCTOR]: {
    id: RoleId.DOCTOR,
    nameKo: '곶자왈 의사',
    team: RoleTeam.CITIZEN,
    description: '한 게임에 한 번, 사망한 플레이어를 부활시킵니다. (기자 제외)',
    minPlayers: 0,
    abilities: [{
      id: 'doctor_revive', nameKo: '부활', description: '사망한 플레이어 한 명을 부활시킵니다. (기자 제외)',
      timing: 'night', frequency: 'once_per_game', targetCount: 1,
    }],
  },
  [RoleId.POLICE]: {
    id: RoleId.POLICE,
    nameKo: '곶자왈 순경',
    team: RoleTeam.CITIZEN,
    description: '매일 밤 한 명의 소속을 확인합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'police_investigate', nameKo: '조사', description: '한 명을 선택해 소속을 확인합니다.',
      timing: 'night', frequency: 'every_night', targetCount: 1,
    }],
  },
  [RoleId.SOCIALITE]: {
    id: RoleId.SOCIALITE,
    nameKo: '곶자왈 마당발',
    team: RoleTeam.CITIZEN,
    description: '매일 밤 두 명을 선택해, 소속이 같은지 확인합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'socialite_compare', nameKo: '비교', description: '두 명을 선택해 소속이 같은지 확인합니다.',
      timing: 'night', frequency: 'every_night', targetCount: 2,
    }],
  },
  [RoleId.COAST_GUARD]: {
    id: RoleId.COAST_GUARD,
    nameKo: '제주 해경',
    team: RoleTeam.CITIZEN,
    description: '한 게임에 한 번, 한 명을 사살합니다. 마피아가 아니면 본인이 죽습니다.',
    minPlayers: 0,
    abilities: [{
      id: 'coast_guard_kill', nameKo: '체포', description: '한 명을 사살합니다. 마피아가 아니면 본인이 죽습니다.',
      timing: 'night', frequency: 'once_per_game', targetCount: 1,
    }],
  },
  [RoleId.PROTECTOR_GRANDMA]: {
    id: RoleId.PROTECTOR_GRANDMA,
    nameKo: '설문대 할망',
    team: RoleTeam.CITIZEN,
    description: '매일 밤 한 명을 보스의 사살로부터 보호합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'protector_protect', nameKo: '보호', description: '한 명을 보스의 사살로부터 보호합니다.',
      timing: 'night', frequency: 'every_night', targetCount: 1,
    }],
  },
  [RoleId.BLOCKER_GRANDMA]: {
    id: RoleId.BLOCKER_GRANDMA,
    nameKo: '김만덕 할망',
    team: RoleTeam.CITIZEN,
    description: '한 게임에 한 번, 한 명의 능력 사용을 막습니다.',
    minPlayers: 0,
    abilities: [{
      id: 'blocker_block', nameKo: '봉인', description: '한 명을 선택해 능력 사용을 막습니다.',
      timing: 'night', frequency: 'once_per_game', targetCount: 1,
    }],
  },
  [RoleId.DOUBLE_VOTER]: {
    id: RoleId.DOUBLE_VOTER,
    nameKo: '오일장 고씨',
    team: RoleTeam.CITIZEN,
    description: '한 게임에 한 번, 투표권을 2회 행사합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'double_vote', nameKo: '추가 투표', description: '투표권을 2회 행사합니다.',
      timing: 'day_vote', frequency: 'once_per_game', targetCount: 0,
    }],
  },
  [RoleId.FISHERMAN]: {
    id: RoleId.FISHERMAN,
    nameKo: '어부 양씨',
    team: RoleTeam.CITIZEN,
    description: '매일 밤, 투표로 죽은 사람이 마피아인지 확인합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'fisherman_check', nameKo: '확인', description: '투표로 사망한 사람이 마피아인지 확인합니다.',
      timing: 'night', frequency: 'every_night', targetCount: 0,
    }],
  },
  [RoleId.VILLAGE_HEAD]: {
    id: RoleId.VILLAGE_HEAD,
    nameKo: '이장 부씨',
    team: RoleTeam.CITIZEN,
    description: '게임 시작 시, 한 명의 소속 팀(시민/마피아)이 제공됩니다.',
    minPlayers: 12,
    abilities: [{
      id: 'village_head_reveal', nameKo: '정보', description: '시민 한 명의 정체를 알게 됩니다.',
      timing: 'game_start', frequency: 'once_per_game', targetCount: 0,
    }],
  },
  [RoleId.MONGSENGI]: {
    id: RoleId.MONGSENGI,
    nameKo: '아랫마을 몽생이',
    team: RoleTeam.CITIZEN,
    description: '다른 시민 직업으로 표시됩니다. 본인은 이 사실을 모르며, 거짓 직업의 능력은 적용되지 않습니다.',
    minPlayers: 0,
    abilities: [],
  },
  [RoleId.IDLER]: {
    id: RoleId.IDLER,
    nameKo: '윗마을 한량',
    team: RoleTeam.CITIZEN,
    description: '조사 대상이 되면 마피아로 표시됩니다.',
    minPlayers: 0,
    abilities: [],
  },
  [RoleId.COUNCIL_MEMBER]: {
    id: RoleId.COUNCIL_MEMBER,
    nameKo: '제주 도의원',
    team: RoleTeam.CITIZEN,
    description: '투표로 사망할 경우, 시민 팀이 패배합니다.',
    minPlayers: 12,
    abilities: [],
  },
  [RoleId.REPORTER]: {
    id: RoleId.REPORTER,
    nameKo: '제주 일보 기자',
    team: RoleTeam.CITIZEN,
    description: '사망 시, 한 명의 소속을 정확하게 확인합니다. 다른 능력으로 방해할 수 없습니다.',
    minPlayers: 0,
    abilities: [{
      id: 'reporter_investigate', nameKo: '취재', description: '한 명의 소속을 정확하게 확인합니다.',
      timing: 'on_death', frequency: 'once_per_game', targetCount: 1,
    }],
  },
  [RoleId.FORTUNE_TELLER]: {
    id: RoleId.FORTUNE_TELLER,
    nameKo: '제주 심방',
    team: RoleTeam.CITIZEN,
    description: '매일 밤, 해당 밤에 능력을 사용한 시민의 숫자를 확인합니다.',
    minPlayers: 0,
    abilities: [{
      id: 'fortune_teller_count', nameKo: '점', description: '이번 밤 능력을 사용한 시민의 숫자를 확인합니다.',
      timing: 'night', frequency: 'every_night', targetCount: 0,
    }],
  },
  [RoleId.IMMIGRANT]: {
    id: RoleId.IMMIGRANT,
    nameKo: '이주민',
    team: RoleTeam.CITIZEN,
    description: '시민 팀이지만 특수 점수 규칙. 낮에 시민팀으로 헌신 선택 가능(되돌릴 수 없음). 헌신 시 순경 능력 1회.',
    minPlayers: 12,
    abilities: [{
      id: 'immigrant_commit', nameKo: '헌신', description: '시민팀으로 헌신합니다. 순경 능력을 1회 사용할 수 있습니다.',
      timing: 'day_choice', frequency: 'once_per_game', targetCount: 0,
    }],
  },
};

export const MAFIA_ROLES = Object.values(ROLE_META).filter(r => r.team === RoleTeam.MAFIA);
export const CITIZEN_ROLES = Object.values(ROLE_META).filter(r => r.team === RoleTeam.CITIZEN);
