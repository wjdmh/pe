// 간단한 폼 제출 처리
function handleSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const message = document.getElementById('message').value;
  // 실제 서비스에서는 서버로 데이터를 전달하는 로직이 들어갑니다.
  alert(`감사합니다, ${name}님! 문의내용을 잘 받았습니다.`);
  // 폼 초기화
  event.target.reset();
}

// 페이지가 로드된 후 실행되는 초기화 함수
document.addEventListener('DOMContentLoaded', function() {
  /*
    종목별로 동아리를 운영하는 대표 대학 목록입니다. 대학스포츠 알리미에 공개된 자료를 참고해
    축구, 농구, 야구, 배구, 태권도 등 주요 종목의 학교들을 선별했습니다【958516205980376†L100-L119】【958516205980376†L169-L176】.
    실제 서비스에서는 데이터베이스를 연동하여 더 많은 학교 목록을 자동으로 생성하도록 구현할 수 있습니다.
  */
  const clubUniversities = {
    '축구': [
      '고려대학교','연세대학교','경희대학교','성균관대학교','서울대학교',
      '한양대학교(ERICA)','용인대학교','홍익대학교','경기대학교','명지대학교'
    ],
    '농구': [
      '경희대학교','고려대학교','연세대학교','성균관대학교','한양대학교',
      '단국대학교','동국대학교','중앙대학교','수원대학교','조선대학교'
    ],
    '야구': [
      '건국대학교','경희대학교','고려대학교','연세대학교','성균관대학교',
      '동국대학교','명지대학교','홍익대학교','강릉영동대학교','경성대학교'
    ],
    '배구': [
      '경기대학교','경희대학교','성균관대학교','명지대학교','조선대학교',
      '홍익대학교','중부대학교','경상국립대학교','광주여자대학교','국립목포대학교'
    ],
    '태권도': [
      '경희대학교','용인대학교','한국체육대학교','경운대학교','동명대학교',
      '나사렛대학교','신성대학교','동아대학교','고신대학교','우석대학교'
    ]
  };

  /*
    대학별로 운영하는 종목 목록입니다. 역시 대학스포츠 알리미 자료를 기반으로 일부 대학의 운동부 현황을 정리했습니다【958516205980376†L100-L119】【958516205980376†L169-L176】.
    실제 서비스에서는 데이터베이스에서 동적으로 로드해야 합니다.
  */
  const universityClubs = {
    '경희대학교': ['축구','농구','야구','배구','태권도','배드민턴','아이스하키','양궁','체조','하키','핸드볼','골프','럭비'],
    '성균관대학교': ['축구','농구','야구','배구','육상','펜싱','골프'],
    '연세대학교': ['축구','농구','야구','럭비','아이스하키'],
    '고려대학교': ['축구','농구','야구','럭비','아이스하키'],
    '서울대학교': ['축구','야구'],
    '한양대학교(ERICA)': ['축구'],
    '용인대학교': ['축구','태권도'],
    '홍익대학교': ['축구','농구','야구'],
    '경기대학교': ['축구','배구','씨름','유도','조정','탁구'],
    '명지대학교': ['축구','배구'],
    '단국대학교': ['농구'],
    '동국대학교': ['농구','야구'],
    '중앙대학교': ['농구'],
    '수원대학교': ['농구'],
    '조선대학교': ['농구','배구'],
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

  // 기본 매핑을 전역으로 저장합니다. 서버에서 가져온 데이터가 있으면 덮어쓰입니다.
  window.clubUniversities = clubUniversities;
  window.universityClubs = universityClubs;

  // 서버에서 종목-대학 매핑 정보를 가져와 전역 변수에 저장합니다.
  fetch('/api/clubs')
    .then(resp => resp.ok ? resp.json() : null)
    .then(data => {
      if (data) {
        window.clubUniversities = data.clubUniversities || window.clubUniversities;
        window.universityClubs = data.universityClubs || window.universityClubs;
      }
    })
    .catch(err => {
      console.error('Failed to fetch club mappings', err);
    });

  /**
   * 선택된 학교와 종목의 동아리 정보를 표시하고 편집할 수 있도록 하는 함수
   * @param {HTMLElement} card - 현재 종목 카드를 나타내는 요소
   * @param {string} sport - 선택된 종목명
   * @param {string} univ - 선택된 대학명
   * @param {HTMLElement|null} listEl - 종목별 대학 목록 요소 (숨김 처리용)
   * @param {HTMLElement|null} searchInput - 대학 검색 입력 요소 (숨김 처리용)
   */
  function showClubInfo(card, sport, univ, listEl, searchInput) {
    // 목록과 검색창을 숨깁니다
    if (listEl) listEl.style.display = 'none';
    if (searchInput) searchInput.style.display = 'none';
    // 상세 정보 컨테이너를 가져오거나 생성
    let detail = card.querySelector('div.university-info');
    if (!detail) {
      detail = document.createElement('div');
      detail.className = 'university-info';
      card.appendChild(detail);
    }
    const key = sport + '_' + univ;
    // 서버에서 저장된 동아리 정보를 가져옵니다. 성공하지 못하면 빈 객체로 초기화합니다.
    let saved = {};
    // 동기적인 로딩을 위해 fetch를 사용하지만, UI 업데이트는 비동기로 처리합니다.

    // helper: fetch saved info from backend
    async function loadSaved() {
      try {
        const resp = await fetch(`/api/info?sport=${encodeURIComponent(sport)}&univ=${encodeURIComponent(univ)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data && Object.keys(data).length > 0) {
            saved = data;
          }
        }
      } catch (err) {
        console.error('Failed to load club info', err);
      }
    }
    // 생성 함수: 정보 표시 영역을 새로 만듭니다
    function buildInfoDisplay() {
      let html = '<div class="club-info-display">';
      html += `<p><strong>동아리 이름:</strong> ${saved.name || ''}</p>`;
      html += `<p><strong>회장 이름:</strong> ${saved.president || ''}</p>`;
      html += `<p><strong>회장 연락처:</strong> ${saved.phone || ''}</p>`;
      html += `<p><strong>수상 경력:</strong> ${saved.awards || ''}</p>`;
      html += `<p><strong>창립 연도:</strong> ${saved.foundingYear || ''}</p>`;
      html += `<p><strong>소개:</strong> ${saved.description || ''}</p>`;
      html += '</div>';
      return html;
    }
    // 비동기 작업을 수행한 후 상세 정보를 표시하는 내부 함수
    async function renderDetail() {
      await loadSaved();
      // 세부정보 영역 구성
      let html = `<h4>${univ} ${sport} 동아리 정보</h4>`;
      html += buildInfoDisplay();
      const editLabel = Object.keys(saved).length > 0 ? '수정' : '정보 입력';
      html += `<button class="edit-club-info-button">${editLabel}</button>`;
      // 편집 폼
      html += `<form class="club-info-form" style="display:none; margin-top:0.5rem;">
        <label>동아리 이름<input type="text" name="name" value="${saved.name || ''}" required></label>
        <label>회장 이름<input type="text" name="president" value="${saved.president || ''}"></label>
        <label>회장 연락처<input type="text" name="phone" value="${saved.phone || ''}"></label>
        <label>수상 경력<textarea name="awards" rows="2">${saved.awards || ''}</textarea></label>
        <label>창립 연도<input type="text" name="foundingYear" value="${saved.foundingYear || ''}"></label>
        <label>소개<textarea name="description" rows="3">${saved.description || ''}</textarea></label>
        <button type="submit" class="save-club-info-button">저장</button>
        <button type="button" class="cancel-edit-button">취소</button>
      </form>`;
      html += `<button class="back-button">목록으로</button>`;
      detail.innerHTML = html;
      detail.style.display = 'block';
      // 이벤트 설정
      const backBtn = detail.querySelector('.back-button');
      backBtn.addEventListener('click', () => {
        detail.style.display = 'none';
        if (listEl) listEl.style.display = 'block';
        if (searchInput) searchInput.style.display = 'block';
      }, { once: true });
      const editBtn = detail.querySelector('.edit-club-info-button');
      const form = detail.querySelector('.club-info-form');
      const infoDiv = detail.querySelector('.club-info-display');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (infoDiv) infoDiv.style.display = 'none';
          form.style.display = 'block';
        }, { once: true });
      }
      if (form) {
        // 취소 버튼
        form.querySelector('.cancel-edit-button').addEventListener('click', () => {
          form.style.display = 'none';
          if (infoDiv) infoDiv.style.display = 'block';
        });
        // 저장 처리
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const formData = new FormData(form);
          saved = {
            name: formData.get('name') || '',
            president: formData.get('president') || '',
            phone: formData.get('phone') || '',
            awards: formData.get('awards') || '',
            foundingYear: formData.get('foundingYear') || '',
            description: formData.get('description') || ''
          };
          try {
            // 서버에 저장 요청
            await fetch('/api/info', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sport: sport, univ: univ, info: saved })
            });
          } catch (error) {
            console.error('서버 저장 실패', error);
          }
          // 표시 영역 업데이트
          if (infoDiv) infoDiv.innerHTML = buildInfoDisplay();
          form.style.display = 'none';
          if (infoDiv) infoDiv.style.display = 'block';
          editBtn.textContent = '수정';
        });
      }
    }
    // render detail asynchronously
    renderDetail();
  }

  // 각 클럽 카드에 공유 일정 버튼과 컨테이너 추가
  document.querySelectorAll('.club-card').forEach(card => {
    const calendarBtn = document.createElement('button');
    calendarBtn.className = 'calendar-button';
    calendarBtn.textContent = '공유 일정';
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-container';
    calendarContainer.style.display = 'none';
    const sportName = card.getAttribute('data-sport') || card.querySelector('h3').textContent.trim();
    calendarContainer.innerHTML = `<p><strong>${sportName}</strong> 종목의 공유 일정입니다. 추후 대학교들 간의 경기 일정이나 이벤트를 이 곳에서 확인할 수 있습니다.</p>`;
    calendarBtn.addEventListener('click', () => {
      calendarContainer.style.display = calendarContainer.style.display === 'none' ? 'block' : 'none';
    });
    card.appendChild(calendarBtn);
    card.appendChild(calendarContainer);
  });

  // 종목 카드의 "동아리 보기" 버튼 클릭 시 대학 리스트를 보여줍니다.
  document.querySelectorAll('.club-card .view-button').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const card = e.target.closest('.club-card');
      if (!card) return;
      const sport = card.getAttribute('data-sport') || card.querySelector('h3').textContent.trim();
      let listEl = card.querySelector('ul.university-list');
      let searchInput = card.querySelector('input.university-search');
      if (!searchInput) {
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '대학교명 검색';
        searchInput.className = 'university-search';
        searchInput.addEventListener('input', function() {
          const filter = this.value.trim();
          if (listEl) {
            listEl.querySelectorAll('li').forEach(li => {
              li.style.display = li.textContent.includes(filter) ? '' : 'none';
            });
          }
        });
        if (!listEl) {
          listEl = document.createElement('ul');
          listEl.className = 'university-list';
          card.appendChild(listEl);
        }
        card.insertBefore(searchInput, listEl);
      } else if (!listEl) {
        listEl = document.createElement('ul');
        listEl.className = 'university-list';
        card.appendChild(listEl);
      }
      // 이미 목록이 채워져 있으면 표시/숨김만 토글
      if (listEl.childElementCount > 0) {
        const hidden = listEl.style.display === 'none';
        listEl.style.display = hidden ? 'block' : 'none';
        if (searchInput) searchInput.style.display = hidden ? 'block' : 'none';
        return;
      }
      // 대학 목록 생성
      const universities = clubUniversities[sport] || ['데이터 준비 중'];
      universities.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u;
        li.addEventListener('click', () => {
          showClubInfo(card, sport, u, listEl, searchInput);
        });
        listEl.appendChild(li);
      });
      listEl.style.display = 'block';
      if (searchInput) searchInput.style.display = 'block';
    });
  });

  // 메인 페이지의 "동아리 찾기" 버튼 - 전역 검색 섹션 표시
  const openSearchBtn = document.getElementById('open-search-btn');
  const searchSection = document.getElementById('club-search-section');
  const searchInputGlobal = document.getElementById('club-search-input');
  const searchResults = document.getElementById('club-search-results');
  const globalUnivInfo = document.getElementById('global-univ-info');
  if (openSearchBtn) {
    openSearchBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (searchSection) {
        searchSection.style.display = 'block';
        searchSection.scrollIntoView({ behavior: 'smooth' });
      }
      if (searchInputGlobal) {
        searchInputGlobal.value = '';
        searchInputGlobal.focus();
      }
      if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'block';
      }
      if (globalUnivInfo) {
        globalUnivInfo.style.display = 'none';
      }
    });
  }

  // 전역 검색 데이터
  const sportsList = Array.from(document.querySelectorAll('.club-card')).map(card => card.getAttribute('data-sport'));
  const universityListGlobal = Object.keys(universityClubs);

  // 검색 결과 항목 생성 함수
  function createSearchResultItem(label, type) {
    const li = document.createElement('li');
    li.textContent = label + (type === 'sport' ? ' (종목)' : ' (대학교)');
    li.className = 'search-result-item';
    li.addEventListener('click', () => {
      if (type === 'sport') {
        const targetCard = document.querySelector(`.club-card[data-sport="${label}"]`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.classList.add('highlight');
          setTimeout(() => {
            targetCard.classList.remove('highlight');
          }, 2000);
        }
      } else if (type === 'university') {
        if (globalUnivInfo) {
          const clubs = universityClubs[label] || [];
          let html = `<h4>${label} 운동 동아리</h4>`;
          if (clubs.length > 0) {
            html += '<ul>' + clubs.map(c => `<li>${c}</li>`).join('') + '</ul>';
          } else {
            html += `<p>${label}의 동아리 정보는 준비 중입니다.</p>`;
          }
          html += '<button class="back-button global-back">목록으로</button>';
          globalUnivInfo.innerHTML = html;
          globalUnivInfo.style.display = 'block';
          if (searchResults) searchResults.style.display = 'none';
          const backBtn = globalUnivInfo.querySelector('.global-back');
          if (backBtn) {
            backBtn.addEventListener('click', () => {
              globalUnivInfo.style.display = 'none';
              if (searchResults) searchResults.style.display = 'block';
            }, { once: true });
          }
        }
      }
    });
    return li;
  }

  // 전역 검색 입력 이벤트
  if (searchInputGlobal) {
    searchInputGlobal.addEventListener('input', function() {
      const query = this.value.trim();
      if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'block';
      }
      if (globalUnivInfo) globalUnivInfo.style.display = 'none';
      if (query === '') return;
      sportsList.forEach(sport => {
        if (sport && sport.includes(query)) {
          searchResults.appendChild(createSearchResultItem(sport, 'sport'));
        }
      });
      universityListGlobal.forEach(univ => {
        if (univ.includes(query)) {
          searchResults.appendChild(createSearchResultItem(univ, 'university'));
        }
      });
      if (searchResults && searchResults.childElementCount === 0) {
        const li = document.createElement('li');
        li.textContent = '검색 결과가 없습니다.';
        li.className = 'search-result-item';
        searchResults.appendChild(li);
      }
    });
  }
});