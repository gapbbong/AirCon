# LG 시스템 에어컨 중앙제어기 (`ACP 5` / `PACP5A000`) REA 리버싱 및 네트워크 분석 종합 보고서

본 문서는 교실 에어컨(`LG P/No. MEZ61995603` 라벨 부품 포함)을 웹에서 제어하기 위해 학교 내부 네트워크(`10.128.48.0/20`) 스캔 및 **REA (Reverse Engineer Anything)** 정적 분석을 통해 밝혀낸 모든 기술 정보를 정리한 문서입니다.

---

## 1. 사전 조사 및 교내 네트워크(`10.128.x.x`) 스캔 결과

### 1.1 부품 번호(`MEZ61995603`) 정체
- `LG P/No. MEZ61995603`은 통신 모듈 모델명이 아니라, LG전자 에어컨 본체 또는 유/무선 리모컨에 부착되는 **인쇄물/라벨(Part Number)** 코드입니다.
- 교실에 설치된 에어컨은 천장형 LG 시스템 에어컨(4-Way 실내기, 코드명 `idu_4w`)이며, 각 실내기는 RS-485 통신선을 통해 학교 중앙제어기와 연결되어 있습니다.

### 1.2 교내 네트워크(`10.128.48.0/20`) 주요 발견 장비一覧
교실 PC(`10.128.56.41`)에서 서브넷 대역(`10.128.48.x` ~ `10.128.63.x`)을 스캔하여 식별한 주요 웹/제어 서버 목록입니다.

| IP 주소 | 오픈 포트 | 식별된 장비 / 시스템 | 세부 정보 및 응답 특징 |
| :--- | :--- | :--- | :--- |
| **`10.128.49.203`** | **`80`, `443`** | **LG ACP 5 중앙제어기 (`PACP5A000`)** | **학교 전체 에어컨 중앙제어 웹 서버** (`nginx` -> `HTTPS 443` 리다이렉트, `Express` + `AngularJS`) |
| `10.128.48.51` | `8080` | **Piolink TiFRONT 보안스위치** | SSL 인증서: `CN=TiFRONT, OU=Research, O=Piolink`, MAC: `00-06-c4-12-74-56`. HTTPS 접속 시 ACL에 의해 `403 Forbidden` 반환 |
| `10.128.55.38` | `80` | **WOW IoT Platform** | `(주)와우시스템 (WoWSYSTEM Co.,Ltd.)` 로컬 IoT 교육/관제 플랫폼 (`Apache/2.4.41 (Ubuntu)`, `/login/login.php`) |
| `10.128.49.200` | `80` | **RecordON 서버** | `Microsoft-IIS/10.0` (`ASP.NET`), `/RecOnHtml/index.php` 로그인 페이지 |
| `10.128.49.216` | `80`, `5000`, `5001` | **Synology NAS** | `https://10.128.49.216:5001`로 리다이렉트 |
| `10.128.49.79`, `215` | `80`, `443` | 내부 임베디드 웹 서버 | `nginx` 기반 관리 페이지 (`Set-Cookie: sid=...`) |
| `10.128.49.153`, `195`, `212`, `225~245` | `80`, `443`, `9101` | 네트워크 프린터 / 복합기 | Samsung(`M332x`, `CLP-680`), Canon(`LBP8140Kdn`), HP Embedded Web Server (`Virata-EmWeb`) |

---

## 2. LG 중앙제어기 정밀 판별 결과 (`10.128.49.203`)

### 2.1 제품군 비교 및 최종 식별 모델
LG전자 B2B 중앙제어 솔루션 4종(`AC Manager 5`, `ACP 5`, `AC Smart 5`, `AC Ez Touch`) 중, `https://10.128.49.203/api/db/system/select_system_small` API 응답을 통해 **`ACP 5` (`PACP5A000`)** 모델임을 최종 확인했습니다.

- **실제 API 응답 (`GET /api/db/system/select_system_small`)**:
  ```json
  {
    "language": "ko",
    "product_type": "ACP_5",
    "is_ddcplus": false,
    "need_to_set_admin": false,
    "signage_enable": false
  }
  ```
- **생존 확인 API 응답 (`POST /api/system/is_alive`)**:
  ```json
  {
    "systemtime": "2026-10-13T15:00:44+00:00",
    "pid": 1190
  }
  ```

### 2.2 LG `ACP 5` (`PACP5A000`) 하드웨어 및 제어 스펙 (`angular-config.js` 기준)
- **최대 제어 용량 (`MAXIMUM.ACP_DMODEL.ACP_5`)**:
  - 최대 포인트(`STDIO`): **256대** (실내기 최대 256대 연결)
  - 실외기(`ODU`): 최대 64대 (`ODU_MAX: 64`)
  - 공조기(`AHU`): 16대 / 칠러(`CHILLER`): 10대 / 확장 IO(`EXPANSION_IO`): 16개 / `DI`: 10포트 / `DO`: 4포트
- **지원 기능**:
  - 개별/그룹 실내기 운전·정지 (`ON` / `OFF`)
  - 운전 모드 설정 (`COOL` 냉방 / `HEAT` 난방 / `AUTO` 자동 / `DRY` 제습 / `FAN` 송풍)
  - 풍량 제어 (`LOW` 약 / `MID` 중 / `HIGH` 강 / `AUTO` 자동 / `POWER` 파워)
  - 희망 온도 설정 및 실내 온도(`ac_roomtemp`) 실시간 모니터링
  - 리모컨 잠금 제어 (`lock` 전체잠금 / `settemp_lock` 온도잠금 / `mode_lock` 모드잠금 / `fan_lock` 풍량잠금)
  - 주간/월간/연간 스케줄 제어, 인터락(연동) 제어, 운전시간 제한, 피크/디맨드 전력 제어, 에너지 내비게이션

---

## 3. REA (Reverse Engineer Anything) 정적 분석 결과

- **REA Evidence ID**: `ev_ee67188957140396c7fd25868ae0283af1e2066ca16bb12a74c99b8e659c2f10` (Parent: `ev_fc22143e38ee4ec02a5ff173604c3c897efa7b7473cfb7583e1b11dd49316467`)
- **대상 아티팩트 해시 (`SHA-256`)**: `177fcf0842701067bc01925167f5e1d2324bb58d0453895e0b874397103fec03`
- **분석 통계**: 추출된 핵심 JS 파일, AST 노드 45,139개, 데이터 플로우 관계 24,859개, 오브젝트 플로우 3,822개, 클로저 2,586개, 콜 플로우 579개 복원 완료.

### 3.1 소프트웨어 아키텍처
1. **Reverse Proxy**: `nginx` (HTTP 80 요청을 HTTPS 443으로 `302 Found` 리다이렉트)
2. **Backend WAS**: `Node.js` + `Express` (`X-Powered-By: Express`, PID `1190`)
   - 로컬 SQLite/DB 조회 라우트: `/api/db/<module>/<func>`
   - 하드웨어/NAI 제어 라우트: `/api/wapi/<module>/<func>`
   - 시스템 제어 라우트: `/api/system/<func>`
   - 인증 라우트: `/auth`, `/auth/userInfo`, `/auth/check`, `/auth/stupid`
3. **Frontend SPA**: `AngularJS 1.x` (`ng-app="acmanagerApp"`) + `UI-Router` + `Kendo UI` + `D3.js` + `CryptoJS`

### 3.2 핵심 상수 및 암호화 키 (`src/angular-config.js`)
- **AES 대칭키 (`CONFIG.SECRET_KEY`)**:
  ```javascript
  SECRET_KEY: "W03Cv48tslpT1C0iH37a134C6Y01E"
  ```
- **제어 포인트 타입 ID (`CONFIG.CP_TYPE_ID`)**:
  | 기기 분류 | 상수명 | 코드 값 (Decimal) | Hex |
  | :--- | :--- | :---: | :---: |
  | AC Manager | `AC_MANAGER` | `65536` | `0x10000` |
  | ACP 중앙제어기 | `ACP` | `131072` | `0x20000` |
  | 실외기 | `ODU` | `196608` | `0x30000` |
  | **실내기 (교실 에어컨)** | **`IDU`** | **`262144`** | **`0x40000`** |
  | 환기 장치 | `VENT` | `327680` | `0x50000` |
  | 공조기 | `AHU` | `393216` | `0x60000` |
  | 히트펌프 보일러 | `AWHP` | `458752` | `0x70000` |
  | DO 키트 | `DOKIT` | `524288` | `0x80000` |
  | 칠러 | `CHILLER` | `589824` | `0x90000` |
  | 디지털 입력 / 출력 | `DI` / `DO` | `655360` / `720896` | `0xA0000` / `0xB0000` |
  | 확장 IO / UIO 포트 | `EXPANSION_IO` / `UIO_PORT` | `786432` / `851968` | `0xC0000` / `0xD0000` |
  | 공기청정기 | `AIRCARE` | `917504` | `0xE0000` |

- **실내기(`IDU`) 세부 모델 아이콘 코드 (`cpinfo.service.js`)**:
  - `idu_4w` (4-Way 천장형 카세트 - 교실 기본형)
  - `idu_2w` (2-Way), `idu_1w` (1-Way), `idu_stand` (스탠드형), `idu_wall` (벽걸이형), `idu_duct` (덕트형), `idu_round` (원형 카세트)

---

## 4. 인증 및 제어 API 상세 명세

### 4.1 로그인 및 세션 인증 (`src/services/auth.service.js`)
- **로그인 요청**:
  - `POST https://10.128.49.203/auth`
  - `Content-Type: application/json`
  - **Request Body**:
    ```json
    {
      "provider": "password",
      "username": "admin",
      "password": "<비밀번호>",
      "guid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
    ```
- **세션 복호화 로직**:
  - 로그인 성공 시 응답 JSON 내 `data.userInfo`에 AES 암호화된 사용자 정보 및 메뉴 권한(`menu_perm`)이 반환됩니다.
  - 프론트엔드는 아래와 같이 복호화합니다:
    ```javascript
    var decryptedData = CryptoJS.AES.decrypt(
      data.userInfo.toString(),
      "W03Cv48tslpT1C0iH37a134C6Y01E"
    ).toString(CryptoJS.enc.Utf8);
    var user = JSON.parse(decryptedData);
    ```
- **비밀번호 정책 (`locale/ko.json` `ADDITION.HTML.293`)**:
  - 최초 관리자 비밀번호 생성 시 **"영문, 숫자 조합 10자 이상"** 규칙이 적용됩니다.

### 4.2 인증 여부 및 히든 기능 분석 (`src/login/login.controller.js`)
1. **비인증 상태에서의 API 접근 제한**:
   - `/api/wapi/*` 등 모든 제어 및 기기 목록 조회 API는 Express 세션 미들웨어를 거치며, 미인증 시 `302 Found`를 반환하며 차단됩니다.
   - 따라서 **유효한 ID/PW 로그인 세션 없이는 외부에서 임의로 에어컨을 조작할 수 없습니다.**
2. **히든 터치 영역 (`target-1` ~ `target-4`)**:
   - 로그인 화면(`src/login/login.html`)의 네 모서리(`(0,0)`, `(924,0)`, `(0,500)`, `(924,500)`)에 `100x100px` 크기의 투명 `div`가 배치되어 있습니다.
   - `target-1`(좌상단)과 `target-2`(우상단)를 번갈아 총 6회 클릭하면 `/#/fct` (공장 테스트 화면)으로 이동합니다.
   - 또한 터치스크린 로컬 모드(`127.0.0.1:8000` / `isSmartLCD == true`)에서 모서리 클릭 시퀀스를 입력해 `/auth/check`에서 키를 발급받으면 `"비밀번호를 초기화 하겠습니까?"` 모달(`#stupid-modal`)이 열리고, 확인 시 `/auth/stupid`를 호출해 비밀번호를 초기화합니다.

### 4.3 교실 에어컨 조회 및 상태 폴링 API (`src/services/cp.service.js`, `wapi.service.js`)
1. **전체 구역(교실) 및 실내기 트리 조회**:
   - `POST /api/wapi/pm/get_cpoint_all`
   - 모든 실내기(`IDU`)의 `id`, `name` (교실 이름), `addr` (실내기 주소, 예: `00-01`), `contain_space_id`, `cp_attr_list` (현재 운전 상태, 설정 온도, 실내 온도, 잠금 상태 등)를 반환합니다.
2. **실시간 상태 변경분 폴링 (5초 주기)**:
   - `POST /api/wapi/get_lpoint_all_small`
   - 응답의 `data` JSON 문자열 내 `lp_list` 객체를 파싱하여 `"값|업데이트시간"` 형태로 각 에어컨의 실시간 상태(온도 변화, 전원 상태 등)를 갱신합니다.

### 4.4 교실 에어컨 제어 명령 API (`src/control/facility.controller.js`, `wapi.service.js`)
- `WAPI.callWAPI(module_name, func_name, params)` 함수를 통해 `POST /api/wapi/<module_name>/<func_name>`으로 `{ "params": ... }` JSON 또는 LGAP XML을 전송합니다.
- **주요 제어 속성 코드 (`cp_attr`)**:
  - `oper` : 운전/정지 (`"ON"` / `"OFF"`)
  - `mode` : 운전 모드 (`"COOL"` 냉방, `"HEAT"` 난방, `"DRY"` 제습, `"FAN"` 송풍, `"AUTO"` 자동)
  - `settemp` : 희망 온도 (섭씨 온도는 내부적으로 `CONFIG.TEMP_TABLE`을 통해 화씨×2 기반 정수 코드로 변환되어 통신, 예: `24.0℃` ↔ `"151"`, `22.0℃` ↔ `"144"`, `20.0℃` ↔ `"136"`, `18.0℃` ↔ `"128"`)
  - `fan` : 바람 세기 (`"LOW"`, `"MID"`, `"HIGH"`, `"AUTO"`, `"POWER"`)
  - `lock` / `settemp_lock` / `mode_lock` / `fan_lock` : 벽면 유선 리모컨 잠금 설정 (`"ON"` / `"OFF"`)

---

## 5. 저장소 파일 목록 (`d:\App\AirCon`)

```text
AirCon/
├── README.md                                    # 프로젝트 및 REA 리버싱 종합 문서
├── ac_index.html                                # LG ACP 5 메인 엔트리 HTML
└── acp_src/
    ├── locale_ko.json                           # 한국어 번역 리소스 전체 (에러 메시지, UI 텍스트)
    └── src/
        ├── angular-config.js                    # 기기 코드, ACP 5 스펙, AES SECRET_KEY, 온도 변환 테이블
        ├── app.js                               # AngularJS 모듈 초기화
        ├── route.js                             # 전체 페이지 라우팅 및 실시간 LP 폴링(getLpoint) 로직
        ├── utility.js                           # 공통 유틸리티
        ├── fct.controller.js                    # 공장 테스트(FCT) 컨트롤러
        ├── control/
        │   └── facility.controller.js           # 에어컨 개별/그룹 제어 핵심 컨트롤러
        ├── login/
        │   ├── login.controller.js              # 로그인, 알람 체크, 히든 모서리 클릭(Check.stupid) 로직
        │   └── login.html                       # 로그인 화면 템플릿
        └── services/
            ├── auth.service.js                  # 로그인 및 CryptoJS AES 세션 복호화
            ├── check.service.js                 # 비밀번호 초기화 히든 체크 서비스 (/auth/check, /auth/stupid)
            ├── cp.service.js                    # 제어 포인트(실내기/실외기) 데이터 모델 및 상태 갱신
            ├── cpinfo.service.js                # 기기별 아이콘 및 모델 매핑
            ├── cptype.service.js                # 설치된 기기 타입 조회
            ├── facility-list.service.js         # 에어컨 제어 명령 생성 및 배치 처리
            ├── facility.service.js              # 공간/기기별 필터링 및 상태 아이콘 처리
            ├── fct.service.js                   # 공장 테스트 API 서비스
            ├── session.service.js               # /auth/:domain 리소스 바인딩
            ├── setting.service.js               # 시스템/네트워크/BACnet/ACP 설정 서비스
            ├── space.service.js                 # 교실/구역(Space) 트리 관리 서비스
            ├── system.service.js                # 백업/복원/재부팅/생존확인 시스템 서비스
            ├── wapi.service.js                  # /api/wapi/* 통신 코어 서비스
            └── xmlapi.service.js                # LGAP XML (<lgapxml version='1.1'>) 빌더 및 전송 서비스
```
