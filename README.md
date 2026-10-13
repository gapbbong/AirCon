# LG ACP 5 (`PACP5A000`) Reverse Engineering & Web Controller

교내 네트워크에서 발견된 **LG 시스템 에어컨 중앙제어기 (`ACP 5` / 모델명: `PACP5A000`)**의 프론트엔드 제어 코드 추출본 및 REA(Reverse Engineer Anything) 정적 분석 결과 저장소입니다.

---

## 1. 장비 및 네트워크 식별 정보

- **장비 모델**: **LG ACP 5 (`PACP5A000`)** — 최대 실내기 256대 제어 지원 중앙제어기
- **내부 접속 URL**: `https://10.128.49.203/` (`HTTP 80` → `HTTPS 443` 리다이렉트, `9101` 제어 포트 오픈)
- **웹 서버 스택**: `nginx` + `Node.js (Express)` + `AngularJS (acmanagerApp)`
- **시스템 상태 확인 API 응답 (`/api/db/system/select_system_small`)**:
  ```json
  {
    "language": "ko",
    "product_type": "ACP_5",
    "is_ddcplus": false,
    "need_to_set_admin": false,
    "signage_enable": false
  }
  ```

---

## 2. 디렉토리 구조

- `ac_index.html` : LG ACP 5 메인 웹 애플리케이션 엔트리 HTML
- `acp_src/src/`
  - `angular-config.js` : 기기 타입 ID(`IDU`, `ODU`, `VENT`, `AHU`), `ACP_5` 하드웨어 제한 스펙, 온도 변환 테이블(`TEMP_TABLE`), 세션 복호화 키(`SECRET_KEY`) 정의
  - `app.js`, `route.js`, `utility.js` : AngularJS 라우팅 및 유틸리티
  - `login/login.controller.js` : 로그인 및 세션 처리 컨트롤러
  - `control/facility.controller.js` : 개별/그룹 실내기(교실 에어컨) 운전·정지, 냉난방 모드, 희망온도, 풍량, 잠금 제어 컨트롤러
  - `services/`
    - `auth.service.js`, `session.service.js` : `/auth` 로그인 및 AES 세션 복호화 서비스
    - `wapi.service.js` : `/api/wapi/<module>/<func>` 백엔드 제어 호출 래퍼
    - `xmlapi.service.js` : LGAP XML (`<lgapxml version='1.1'>`) 프로토콜 요청 생성기
    - `cp.service.js`, `cpinfo.service.js`, `cptype.service.js` : 제어 포인트(Control Point - 실내기/실외기) 트리 및 상태 파서
    - `facility.service.js`, `facility-list.service.js` : 구역(교실)별 에어컨 상태 필터링 및 제어 서비스
    - `space.service.js`, `setting.service.js`, `system.service.js` : 공간(교실) 그룹 및 시스템 설정 API 서비스

---

## 3. 핵심 제어 API 프로토콜 요약

### ① 인증 (`POST /auth`)
- **Endpoint**: `https://10.128.49.203/auth`
- **Payload**:
  ```json
  {
    "provider": "password",
    "username": "<ID>",
    "password": "<PASSWORD>",
    "guid": "<DEVICE_UUID>",
    "key": "<DEVICE_UUID>"
  }
  ```
- 응답의 `userInfo` 문자열을 `CONFIG.SECRET_KEY` (`W03Cv48tslpT1C0iH37a134C6Y01E`)로 AES 복호화하여 사용자 권한 및 세션 쿠키를 획득합니다.

### ② 전체 교실 에어컨(Control Point) 목록 및 실시간 상태 조회
- **전체 기기 트리 및 속성 조회**: `POST /api/wapi/pm/get_cpoint_all`
- **실시간 논리 포인트(LP) 상태 폴링**: `POST /api/wapi/get_lpoint_all_small`

### ③ 에어컨 제어 명령 전송
- **WAPI 호출**: `POST /api/wapi/<module_name>/<func_name>`
- **LGAP XML 제어**: `src/services/xmlapi.service.js` 및 `src/control/facility.controller.js`를 통해 실내기 운전(`oper`), 운전모드(`mode`: `COOL`/`HEAT`/`AUTO`/`DRY`/`FAN`), 설정온도(`settemp`), 풍량(`fan`), 리모컨 잠금(`lock`) 제어 명령을 전송합니다.
