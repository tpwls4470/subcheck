# subcheck online

기존 Sites 프로젝트에서 실행하는 계정별 웹앱 서버입니다. 설정과 재개 절차는 [CONTINUE.md](../CONTINUE.md)를 참고하세요.

루트에서 `npm run build:online`을 실행하면 화면과 `worker-template.mjs`, `reminders.mjs`, `reminder-api.mjs`를 묶고 `dist` 산출물을 생성합니다. 빌드는 배포하지 않습니다. `worker/index.js`는 생성 파일이며 원본 수정 후 다시 빌드합니다.

`DB` D1 바인딩에 구독, 기기 푸시 설정, 사용량 알림, 수집 기록과 결제정보 확인 대기 기록을 계정별로 저장합니다. 기존 `drizzle` 마이그레이션과 저널을 보존합니다. 스키마 변경 시에만 `npm ci` 후 `npm run db:generate`를 사용합니다.

클링 로그인 토큰은 계정에 결합한 AES-GCM 암호화 Secure/HttpOnly 쿠키로 기기별 보관합니다. 필요한 환경 변수 이름은 `.env.example`에만 기록하며 실제 값은 호스팅 환경에서 관리합니다. 새 컴퓨터에서 기존 비밀 값을 임의로 재발급하거나 저장소에 복사하지 않습니다.

검사: 이 폴더에서 `npm test`. 공식 로그인·플랜·잔액 조회와 사용자 기기의 푸시 수신이 확인됐습니다. 실제 만료 시 갱신·권한 폐기와 예약 결제 알림의 실물 수신은 별도 검증이 남아 있습니다.
