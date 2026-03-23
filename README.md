# 제주 마피아 게임

오프라인 마피아 게임 보조 웹앱. 로컬 네트워크에서 호스트가 서버를 실행하고, 플레이어는 QR 스캔으로 참여합니다.

## 설치

```bash
git clone https://github.com/opgdg999-crypto/jejumafia.git
cd jejumafia
npm i
```

## 실행

```bash
npm run dev
```

서버가 시작되면 콘솔에 표시되는 주소로 접속합니다.

- **호스트**: `http://localhost:3000` — 방 생성, 게임 진행
- **플레이어**: QR 코드 스캔 또는 `http://<서버IP>:3000/player`
- **모니터**: `http://<서버IP>:3000/monitor` — TV/대형 화면용
