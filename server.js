const express = require('express');
const fs = require('fs');
const path = require('path');

/*
  간단한 백엔드 서버입니다. 이 서버는 정적 파일을 제공하고 대학 운동 동아리 정보에 대한
  REST API를 제공합니다. 동아리 정보는 JSON 파일(data.json)에 저장되며,
  API를 통해 조회 및 업데이트할 수 있습니다.

  사용 방법:
    1. 프로젝트 루트에서 `npm init -y` 명령을 실행한 후 `npm install express` 로
       의존성을 설치합니다.
    2. 이 파일을 실행하려면 `node server.js` 를 실행하세요. 기본 포트는 3000입니다.
    3. 서버가 실행되면 브라우저에서 http://localhost:3000 을 열어 정적 사이트를 확인할 수 있습니다.
    4. 동아리 정보 API:
         GET  /api/clubs            → 전체 종목-대학 매핑 반환
         GET  /api/info?sport=A&univ=B  → 특정 대학·종목에 대한 동아리 정보를 반환
         POST /api/info            → 특정 대학·종목의 동아리 정보를 저장
            요청 본문 JSON 예시: { "sport": "축구", "univ": "경희대학교", "info": { ... } }

  주의: 이 서버는 데모 목적의 간단한 구현으로 동시성 제어가 없으므로
  실제 배포 환경에서는 데이터베이스를 사용하는 것이 좋습니다.
*/

const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 제공. 현재 디렉토리(프론트엔드 파일 위치)를 공개합니다.
app.use(express.static(path.join(__dirname)));

// JSON 본문 파싱
app.use(express.json());

// 데이터 파일 경로
const dataFile = path.join(__dirname, 'data.json');

// 클럽-대학 매핑 (프론트엔드와 동일)
const clubUniversities = {
  '축구': [
    '고려대학교', '연세대학교', '경희대학교', '성균관대학교', '서울대학교',
    '한양대학교(ERICA)', '용인대학교', '홍익대학교', '경기대학교', '명지대학교'
  ],
  '농구': [
    '경희대학교', '고려대학교', '연세대학교', '성균관대학교', '한양대학교',
    '단국대학교', '동국대학교', '중앙대학교', '수원대학교', '조선대학교'
  ],
  '야구': [
    '건국대학교', '경희대학교', '고려대학교', '연세대학교', '성균관대학교',
    '동국대학교', '명지대학교', '홍익대학교', '강릉영동대학교', '경성대학교'
  ],
  '배구': [
    '경기대학교', '경희대학교', '성균관대학교', '명지대학교', '조선대학교',
    '홍익대학교', '중부대학교', '경상국립대학교', '광주여자대학교', '국립목포대학교'
  ],
  '태권도': [
    '경희대학교', '용인대학교', '한국체육대학교', '경운대학교', '동명대학교',
    '나사렛대학교', '신성대학교', '동아대학교', '고신대학교', '우석대학교'
  ]
};

const universityClubs = {
  '경희대학교': ['축구', '농구', '야구', '배구', '태권도', '배드민턴', '아이스하키', '양궁', '체조', '하키', '핸드볼', '골프', '럭비'],
  '성균관대학교': ['축구', '농구', '야구', '배구', '육상', '펜싱', '골프'],
  '연세대학교': ['축구', '농구', '야구', '럭비', '아이스하키'],
  '고려대학교': ['축구', '농구', '야구', '럭비', '아이스하키'],
  '서울대학교': ['축구', '야구'],
  '한양대학교(ERICA)': ['축구'],
  '용인대학교': ['축구', '태권도'],
  '홍익대학교': ['축구', '농구', '야구'],
  '경기대학교': ['축구', '배구', '씨름', '유도', '조정', '탁구'],
  '명지대학교': ['축구', '배구'],
  '단국대학교': ['농구'],
  '동국대학교': ['농구', '야구'],
  '중앙대학교': ['농구'],
  '수원대학교': ['농구'],
  '조선대학교': ['농구', '배구'],
  '건국대학교': ['야구'],
  '경성대학교': ['야구'],
  '강릉영동대학교': ['야구'],
  '중부대학교': ['배구'],
  '경상국립대학교': ['배구'],
  '광주여자대학교': ['배구'],
  '국립목포대학교': ['배구'],
  '한국체육대학교': ['태권도'],
  '경운대학교': ['태권도'],
  '동명대학교': ['태권도'],
  '나사렛대학교': ['태권도'],
  '신성대학교': ['태권도'],
  '동아대학교': ['태권도'],
  '고신대학교': ['태권도'],
  '우석대학교': ['태권도']
};

// 데이터 파일 읽기
function readData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (err) {
    return {};
  }
}
// 데이터 파일 쓰기
function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// 종목별 대학 목록과 대학별 종목 목록 제공
app.get('/api/clubs', (req, res) => {
  res.json({ clubUniversities, universityClubs });
});

// 특정 대학·종목에 대한 동아리 정보 조회
app.get('/api/info', (req, res) => {
  const { sport, univ } = req.query;
  if (!sport || !univ) {
    return res.status(400).json({ error: 'sport and univ parameters are required' });
  }
  const data = readData();
  const key = `${sport}_${univ}`;
  res.json(data[key] || {});
});

// 특정 대학·종목의 동아리 정보 저장
app.post('/api/info', (req, res) => {
  const { sport, univ, info } = req.body || {};
  if (!sport || !univ || !info) {
    return res.status(400).json({ error: 'sport, univ and info fields are required' });
  }
  const data = readData();
  const key = `${sport}_${univ}`;
  data[key] = info;
  try {
    writeData(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});