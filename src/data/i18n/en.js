// 영어 문구 표. 열쇠는 한국어 화면 글 그대로(화면이 그리기 직전에 바꾼다: src/ui/lang.js).
// 세계의 말: 판 Run · 관 Hall · 대국 Match · 명인 Master · 수 Move · 버리기 Discard · 손 Hand · 주머니 Bag · 사슬 Chain
// 값 Value · 배수 Mult · 끊김 Break · 외통 Mate · 격언 Maxim · 기보 Study · 각인 Engraving · 상금 Purse · 단 Dan
// 꾸러미 Bundle · 두루마리 Scroll · 도감 Almanac · 명국 Classic · 불멸의 기보 Immortal Games · 조각 Fragment · 재현 Reenactment · 판본 Edition
export const EN = {
  
  '사슬이 끝날 때 점수가 목표에 닿으면 이긴다. 넘치면 ×2 · ×5 · ×10 눈금까지 늘어난다': 'Win when a chain ends at or past the goal. Past it, the bar stretches to ×2, ×5, ×10',
  '고른 정석 — 가리키면 무엇을 하는지 보인다': 'Your joseki — point at it to see what it does',
  '묘수 — 떨구기 전에 눌러 이번 대국에 한 번 쓴다': 'A trick — tap it before a drop to use it once this match',
  '창이 작아 글이 작게 보인다 — 설정에서 큰 글자를 켤 수 있다': 'The window is small, so text is small — turn on Big text in Settings',
  // 낱말 풀이(glossary.js)
  '낱말 풀이': 'Glossary', '사슬': 'Chain', '값': 'Value', '배수': 'Mult', '모습': 'Form',
  // 풀이 글은 glossary.js TERMS의 영어 칸(enWord · enSay)에 있다
  // 글 다시 쓰기: 「언제 → 무엇」(친절 손질)
  
  
  '세 칸 이상 미끄러져 먹을 때마다 값 +20': 'Each take after sliding 3+ squares: +20 Value',
  '가운데 네 칸에서 먹을 때마다 배수 ×1.5': 'Center take: ×1.5 Mult',
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  // 카드에 적는 효과 · 새기기 미리 보기(친절 손질)
  '대각선 앞 한 칸의 적을 먹는다': 'Takes one square diagonally ahead', 'ㄱ자로 뛰어 먹는다': 'Leaps in an L to take', 
  '기물 셋 중 하나': 'One of three pieces', '기보 셋 중 하나': 'One of three charts', '각인 셋 중 하나': 'One of three engravings', '판본 격언 셋 중 하나': 'One of three edition maxims',
  '기물에 새긴다': 'Onto a piece', '기물에 깃든다': 'Into a piece', '기물이 자란다': 'Grow one',
  
  '새긴다': 'Engrave', '깃든다': 'Bind', '자란다': 'Grow', '그만': 'Cancel', '이 기물은 자랄 곳이 없다': 'This piece has nothing to grow into',
  '주머니에서 새길 기물을 고른다': 'Choose a piece in your bag to engrave', '주머니에서 깃들 기물을 고른다': 'Choose a piece in your bag for the soul', '주머니에서 자랄 기물을 고른다': 'Choose a piece in your bag to grow',
  '체스 기물이 특수 기물로 자란다': 'A chess piece grows into a special piece',
  // 첫 수업 열 · 처음 안내(친절 손질)
  '기초': 'Basics', '목표 외통': 'Goal: checkmate', '대국': 'Battle', '보기': 'Watch', '할 일': 'Your turn', '누르면 내 차례': 'Tap to play it yourself', '수업 건너뛰기': 'Skip lessons',
  '목표와 수': 'Goal and Moves', '체스 밖의 행마': 'Beyond Chess', 
  '손의 나이트를 누른다': 'Tap the knight in your hand',
  '빛나는 칸에 떨군다 — 그 자리에서 먹을 적이 있는 칸만 빛난다': 'Drop it on a glowing square — only squares with prey in reach glow',
  '흔들리는 적을 눌러 먹는다': 'Tap the trembling enemy to take it',
  '나이트를 든다': 'Pick up the knight', '떨군다': 'Drop it',
  '룩을 먹으면 내 기물이 룩이 된다': 'Take the rook and your piece becomes a rook',
  '이제 룩처럼 곧게 미끄러져 먹는다': 'Now slide straight like a rook and take',
  '먹을 때마다 흰 칸의 값이 더해지고, 금빛 칸의 배수가 1씩 는다': 'Each take adds to the value in the white box and raises the mult in the gold box by 1',
  '점수 = 값 × 배수 — 길게 이을수록 곱이 커진다': 'Score = value × mult — the longer the chain, the bigger the product',
  '룩을 먼저 먹으면 비숍이 그 칸을 지킨다 — 룩 모습으로는 비숍을 못 먹어 사슬이 끊긴다': 'Take the rook first and the bishop guards that square — as a rook you cannot take it, so the chain breaks',
  '비숍을 먹을 수 있는 칸에 떨군다': 'Drop where you can take the bishop',
  '룩을 지키는 비숍부터 먹는다': 'Take the bishop guarding the rook first',
  '지키던 비숍이 없으니 룩을 먹어도 끊기지 않는다': 'With the bishop gone, taking the rook no longer breaks the chain',
  '판 위 막대가 목표. 닿으면 이긴다. 왼쪽 금빛 구슬이 남은 수다': 'The bar above the board is the goal. Reach it to win. The gold beads on the left are your moves',
  '폰을 먹고 첫 수가 끝난다 — 수 구슬이 하나 준다': 'Take the pawn and the first move ends — one bead goes out',
  '남은 수로 목표를 채운다: 비숍을 든다': 'Fill the goal with the move left: pick up the bishop',
  '룩을 먹으면 목표에 닿는다': 'Take the rook to reach the goal',
  '폰은 떨굴 곳이 없다 — 버릴 폰을 누른다': 'Pawns have nowhere to drop — tap a pawn to throw back',
  '새로 쥔 나이트를 든다': 'Pick up the knight you drew', '퀸을 먹는다': 'Take the queen',
  '▼ 그림자는 증원. 이 수가 끝나면 그 칸에 적이 들어온다': 'A ▼ shadow is a reinforcement. An enemy lands there when this move ends',
  '폰을 먹는다. 수가 끝나면 증원이 떨어진다': 'Take the pawn. When the move ends the reinforcement lands',
  '들어온 룩을 먹으러 간다': 'Go take the rook that landed',
  '킹은 지키는 적이 하나라도 있으면 먹을 수 없다 — 룩이 킹을 지킨다': 'A king cannot be taken while anything guards it — the rook guards the king',
  '지키는 룩을 먹을 수 있는 칸에 떨군다': 'Drop where you can take the guarding rook',
  '지키던 룩을 먹으면 내가 룩이 된다': 'Take the guard and you become a rook',
  '지키는 적이 없는 킹을 먹으면 외통. 점수와 상관없이 이긴다': 'Take an unguarded king for a mate. You win whatever the score',
  '포는 특수 기물. 기물 하나를 넘어서 먹는다': 'The cannon is a special piece. It jumps one piece to take',
  '폰을 받침으로 넘을 수 있는 칸에 떨군다': 'Drop where it can jump over the pawn',
  '폰을 넘어 룩을 먹는다': 'Jump the pawn and take the rook',
  '룩이 되었으니 곧게 미끄러져 비숍까지': 'Now a rook, slide straight on to the bishop',
  '진열의 격언 「기사도」를 산다 — 격언은 판 내내 붙어 있다': 'Buy the maxim “Chivalry” — maxims stay with you all run',
  '산 격언은 오른쪽 칸에 들어간다. 효과는 카드에 적혀 있다': 'Maxims you buy sit in the right column. The card says what it does',
  '기물 꾸러미를 연다 — 셋 중 하나를 고른다': 'Open the piece pack — pick one of three',
  '낙타를 고른다 — 나이트처럼 뛰는 특수 기물': 'Take the camel — a special piece that jumps like a knight',
  '알았다': 'Got it', '처음 안내': 'First-time tips', '다시 보기': 'Show again', '처음 안내를 다시 보인다': 'First-time tips will show again',
  '격언은 판 내내 붙어 있다 — 사면 오른쪽 칸에 들어간다': 'Maxims stay all run — bought ones go in the right column',
  '셋 중 하나를 고른다 — 고르지 않고 넘겨도 된다': 'Pick one of three — or skip',
  '두루마리를 누르고 주머니의 기물을 골라 쓴다': 'Tap a scroll, then choose a piece in your bag',
  
  '명인 대국 — 명인은 규칙 하나를 비튼다': 'Master battle — a master twists one rule',
  '금빛 적을 먹으면 금빛 꾸러미를 받는다': 'Take the golden enemy for a golden pack',
  '특성이 있는 적 — 가리키면 무엇을 하는지 보인다': 'An enemy with a trait — point at it to see what it does',
  '판 위의 벽 · 보석 — 가리키면 무엇을 하는지 보인다': 'Walls and gems on the board — point at them to see what they do',
  '체스에 없는 행마를 가진 특수 기물 — 누르면 먹을 수 있는 칸이 보인다': 'A special piece with a move chess does not have — tap it to see where it can take',
  '점선 그림자는 증원 — 이 수가 끝나면 그 칸에 적이 들어온다': 'Dotted shadows are reinforcements — enemies land there when this move ends',
  '격언을 누르면 팔 수 있다 — 끌어서 순서를 바꾼다': 'Tap a maxim to sell it — drag to reorder',
  // ── 화면
  // 혼(깊이 C)
  '혼': 'Soul', '깃들 기물': 'Choose a piece', '지키는 적을 피했다': 'Slipped the guard', 
  
  
  '같은 종류를 잇달아 먹으면 배수 ×2': 'Same kind in a row: ×2 Mult',
  
  '메아리': 'Echo', '초월': 'Transcend', '굶주림': 'Hunger', '사냥꾼': 'Hunter', '순교자': 'Martyr', '그림자': 'Shade',
  // 진화 · 묘수(깊이 F)
  '진화': 'Evolve', '묘수': 'Trick', '자랄 기물': 'Choose a piece', '대국 중에 쓴다': 'In a match', '대국 중 떨구기 전에 쓴다': 'Use during a match, before a drop',
  
  '빙결': 'Freeze', '재장전': 'Reload', '도발': 'Taunt', '수 +1': 'Moves +1',
  
  // 적 특성(깊이 D)
  '방패': 'Shield', '폭약': 'Powder', '거울': 'Mirror', '성채': 'Castle', '배신자': 'Turncoat', '폭발': 'Blast', '순교': 'Martyrdom', '배신자가 넘어온다': 'A turncoat joins you',
  '둘레 여덟 칸을 모두 지킨다': 'Guards all eight squares around it', 
  // 도박(깊이 G)
  '도박': 'Gamble', '수상한 물약': 'Dubious Potion', '룰렛': 'Roulette', '물약': 'Potion',
  // 정석(깊이 E)
  '정석': 'Joseki', '은': 'Silver', '무지개': 'Rainbow', '주머니가 바뀌었다': 'Your bag changed',
  '기사 서약': "Knight's Oath", 
  '성벽 쌓기': 'Rampart', 
  '주교관': 'Mitre', 
  '활터': 'Archery', 
  '고속도로': 'Highway', 
  '발판': 'Stepping Stones', 

  '새로': 'New', '판의 문': 'Gates', 
  '순교의 맹세': "Martyr's Vow", 
  '결사': 'Blood Pact', 
  '하이랜더': 'Highlander', 
  '왕좌': 'Throne', 
  '오목': 'Five in a Row', 
  '복제': 'Replica', 
  '문': 'Gate', '흡수': 'Absorbed', '다섯 칸': 'Five in a Row',
  '체인메이트': 'CHAINMATE', '잡으면 그것이 된다': 'Take it, be it', '적을 삼켜, 적이 되어라': 'Devour them. Become them.',
  '이어 하기': 'Continue', '새 판': 'New Run', '오늘의 대국': "Today's Match", '도감': 'Almanac', '기록': 'Records', '설정': 'Settings',
  '멈춤': 'Paused', '계속': 'Continue', '타이틀로': 'To Title', '타이틀': 'Title', '돌아가기': 'Back', '다시': 'Again', '계속 두기': 'Play On',
  '소리': 'Sound', '음악': 'Music', '연출 속도': 'Speed', '화면 흔들림': 'Shake', '큰 글자': 'Large Text', '켬': 'On', '끔': 'Off', '언어': 'Language',
  '연습 대국': 'Practice Match', '정식 대국': 'Rated Match', '명인 대국': 'Master Match', '연습': 'Practice', '정식': 'Rated',
  '목표': 'Target', '이기면': 'Win', '건너뛰면': 'If skipped', '건너뜀': 'Skipped', '이김': 'Won', '두기': 'Play', '건너뛰기': 'Skip',
  '이기면 명인의 상자': "Win: Master's Chest", '끝없는 대국': 'Endless',
  '점수': 'Score', '수': 'Moves', '상금': 'Purse', '주머니': 'Bag', '손': 'Hand', '격언': 'Maxim',
  '대국 승리': 'Match Won', '외통 승리': 'Won by Mate', '대국 기본': 'Base', '적립': 'Interest', '외통': 'Mate', '대국 중 번 상금': 'Earned in match', '합': 'Total',
  '금빛 꾸러미가 상점에 나왔다': 'A golden bundle is in the shop',
  '승급': 'Promotion', '넘겼다': 'Survived', '판이 다시 채워진다': 'The board refills', '다시 떨군다': 'Drop again', '목표 달성': 'Target reached',
  '떨굴 곳이 없다': 'Nowhere to drop', '수가 다했다': 'Out of moves', '수를 다 썼다': 'Out of moves',
  '관 선택': 'Matches', '상점': 'Shop', '진열': 'Display', '꾸러미': 'Bundles', '두루마리': 'Scrolls', '나가기': 'Leave', '다음 대국': 'Next match', '샀다': 'Sold', '열었다': 'Opened', '공짜': 'Free',
  '새길 기물': 'Pick a piece to engrave', '이번 상점에선 끝': 'Done for this shop', '할 수 없다': "Can't do that", '격언 칸이 찼다': 'Maxim slots are full',
  '셋 중 하나를 고른다': 'Pick one of three', '판본이 붙은 격언 셋 중 하나': 'One of three maxims with an edition',
  '주머니에 들어온다': 'Goes into your bag', '주머니의 기물 하나에 새긴다': 'Engrave one piece in your bag', '비었다': 'Empty',
  '기물 꾸러미': 'Piece Bundle', '기보 꾸러미': 'Study Bundle', '각인 꾸러미': 'Engraving Bundle', '금빛 꾸러미': 'Golden Bundle',
  '기물': 'Piece', '기보': 'Study', '각인': 'Engraving', '명국 조각': 'Classic Fragment',
  '명인의 상자': "Master's Chest", '한 칸': 'One cell', '세 칸': 'Three cells', '다섯 칸!': 'FIVE CELLS!',
  '조각 셋이면 전설': 'Three make a legend', '불멸의 기보': 'Immortal Games', '전설': 'Legend', '잠듦': 'Asleep', '잠김': 'Locked',
  '첫 조각': 'First fragment', '재현 조각': 'Reenactment fragment', '금빛 조각': 'Golden fragment', '재현': 'Reenact', '금빛': 'Golden',
  '금빛 적을 먹고 이기면 금빛 조각': 'Take a golden piece and win for the golden fragment',
  '판이 끝났다': 'The run is over', '여덟 관을 꺾었다': 'All eight halls conquered', '도달': 'Reached', '최고 한 수': 'Best move',
  '마지막 대국': 'Last match', '모자란 점수': 'Short by', '모은 조각': 'Fragments',
  '오프닝': 'Opening', '단': 'Dan', '기본': 'Standard', '더하는 규칙 없음': 'No added rules',
  '명인': 'Masters', '명국': 'Classics', '판본': 'Editions',
  '판': 'Runs', '이긴 판': 'Runs won', '최고 관': 'Best hall', '전설 완성': 'Legends', '신의 한 수(!!!)': 'Divine moves (!!!)', '열린 단': 'Dan unlocked', '아직': 'Not yet',
  '5관에 닿는다': 'Reach hall 5', '외통으로 다섯 번 이긴다': 'Win by mate five times', '한 사슬에 여덟을 먹는다(!!!)': 'Take eight in one chain (!!!)', '불멸의 기보 하나를 완성한다': 'Complete one immortal game',
  '폰': 'Pawn', '나이트': 'Knight', '비숍': 'Bishop', '룩': 'Rook', '퀸': 'Queen', '킹': 'King',
  '대주교': 'Archbishop', '재상': 'Chancellor', '아마존': 'Amazon', '낙타': 'Camel', '야간기사': 'Nightrider', '메뚜기': 'Grasshopper', '포': 'Cannon', '궁수': 'Archer', '유령': 'Ghost',
  '대주교!': 'Archbishop!', '재상!': 'Chancellor!', '아마존!': 'Amazon!', '낙타!': 'Camel!', '야간기사!': 'Nightrider!', '메뚜기!': 'Grasshopper!', '포!': 'Cannon!', '궁수!': 'Archer!', '유령!': 'Ghost!',
  '비숍 + 나이트로 먹는다': 'Takes as bishop + knight', '룩 + 나이트로 먹는다': 'Takes as rook + knight', '퀸 + 나이트로 먹는다': 'Takes as queen + knight',
  '세 칸 · 한 칸으로 뛴다(늘 같은 색 칸)': 'Leaps 3 and 1 (always the same color)', '나이트 도약을 같은 쪽으로 거듭한다': 'Repeats knight leaps in one direction',
  '첫 기물을 넘어 바로 뒤 칸을 먹는다': 'Hops the first piece, takes just beyond', '가로 · 세로로 하나를 넘어 그 너머 첫 기물을 먹는다': 'Leaps one piece in a line, takes the next',
  '두 칸 떨어진 적을 제자리에서 쏜다': 'Shoots foes two squares away, stays put', '가로 · 세로로 막힘 없이 미끄러진다': 'Slides through anything in a line',
  '뛰어넘었다': 'Vaulted', '꿰뚫었다': 'Pierced', '모든 모습으로': 'Every Form',
  '도약': 'Leap', '직선': 'Line', '대각': 'Diagonal', '변신': 'Shift', '희생': 'Sacrifice', '왕관': 'Crown', '행진': 'March', '사냥': 'Hunt',
  
  
  
  
  
  
  '벽': 'Wall', '보석': 'Gem', 
  '이형': 'Fairy', '이형 기물': 'Fairy Piece', '기물': 'Pieces',
  '첫 수업': 'First Lessons', '첫 수업 다시': 'Lessons Again', '좋은 수': 'Good Move', '끝': 'Done',
  '떨구고 먹는다': 'Drop and Take', '이을수록 곱해진다': 'The Longer, the Bigger', '지키는 적부터': 'Guards First',
  '지금': 'Now', '먹으면': 'Take', '끊긴다': 'Breaks', '사슬이 끝난다': 'Chain ends',
  '이번 수 뒤에 들어온다': 'Arrives after this move', '두 수 뒤에 들어온다': 'Arrives in two moves',
  '꺾으면 판을 이긴다': 'Beat them to win the run',   '지키는 적': 'Guard', '이 적을 먹어야 사슬이 이어진다': 'Take this one to keep the chain', '지금 모습으로는 닿지 않는다': 'Out of reach in this form',
  '한국어': '한국어', 'English': 'English', '없음': 'None',
  // 동사
  '떨구기': 'Drop', '먹기': 'Capture', '갈아입기': 'Change', '끊김': 'Break', '응수': 'Reply', '증원': 'Reinforcement',
  // ── 격언
  '기사도': 'Chivalry', 
  '폰의 행진': 'Pawn March', 
  '변덕': 'Whim', 
  '한결같음': 'Steadfast', 
  '대관식': 'Coronation', '퀸 모습이 될 때마다 값 +50': 'Become a queen: +50 Value',
  '낮은 자세': 'Low Stance', '폰 모습으로 먹을 때마다 배수 +3': 'Each take as a pawn: +3 Mult',
  '대각의 길': 'Diagonal Path', '비숍 모습으로 먹을 때마다 값 +25': 'Each take as a bishop: +25 Value',
  '성벽 허물기': 'Wall Breaker', '룩을 먹을 때마다 배수 +4': 'Each rook taken: +4 Mult',
  '긴 사슬': 'Long Chain', 
  '먼 길': 'Long Road', 
  '가장자리': 'Edge', 
  '중앙 장악': 'Center Grip', 
  '금고': 'Vault', 
  '끝줄의 꿈': 'Back Rank Dream', 
  '승급 잔치': 'Promotion Feast', '승급할 때마다 배수 ×2': 'Each promotion: ×2 Mult',
  '희생': 'Sacrifice', 
  '되갚음': 'Payback', 
  '아슬아슬': 'Close Call', 
  '외통 사냥꾼': 'Mate Hunter', '킹을 지키는 적이 하나 적다': 'Kings have one fewer guard', 
  '왕의 목': "King's Neck", 
  '대국의 기억': 'Memory of Matches', 
  '첫수': 'First Move', 
  '마지막 수': 'Last Move', 
  
  '빈 주머니': 'Empty Bag', 
  '작은 주머니': 'Small Bag', 
  '증원 환영': 'Welcome', 
  '그림자 읽기': 'Shadow Reading', 
  '상아탑': 'Ivory Tower', 
  '기보 수집가': 'Study Collector', 
  '가벼운 발': 'Light Step', 
  '퀸 사냥': 'Queen Hunt', '퀸을 먹을 때마다 값 +60': 'Queen taken: +60 Value',
  '빈 판': 'Bare Board', 
  '되돌이': 'Homecoming', 
  '모습 모으기': 'Form Collector', 
  '응수의 달인': 'Reply Master', 
  '승급의 길': 'Road to Promotion', '승급할 때마다 값 +80': 'Promotion: +80 Value',
  '증원 사냥': 'Reinforcement Hunt', 
  '특진': 'Fast Track', 
  '광마': 'Wild Horse', 
  '룩 리프트': 'Rook Lift', 
  // ── 명인
  '철벽': 'Iron Wall', '적 폰이 좌우 옆 칸도 지킨다': 'Enemy pawns also guard the squares beside them', '적 폰이 옆 칸과 뒤 대각도 지킨다': 'Enemy pawns also guard beside and behind them',
  '안개': 'Fog', '위 세 줄이 안개에 덮인다': 'Fog covers the top three ranks', '내 기물이 닿은 칸만 걷힌다': 'Only squares your piece reaches clear', '안개 속에는 떨굴 수 없다': 'No drops into the fog',
  '거울': 'Mirror', '한 사슬에서 같은 모습으로 두 번 갈아입지 못한다': 'No changing into the same form twice in a chain', '한 사슬에서 같은 종류를 두 번 먹지 못한다': 'No taking the same kind twice in a chain',
  '모래시계': 'Hourglass', '수 3': 'Moves 3', 
  '무거운 손': 'Heavy Hand', '손 3': 'Hand 3', 
  '침묵': 'Silence', '가장 왼쪽 격언이 잠든다': 'Your leftmost maxim sleeps', 
  '앙갚음': 'Grudge', '끊긴 사슬은 점수 반': 'Broken chains score half', '끊긴 사슬은 점수가 없다': 'Broken chains score nothing',
  '대가': 'Grandmaster', '킹이 둘이다': 'There are two kings',
  '적 폰 · 나이트 · 비숍이 둘레 여덟 칸을 모두 지킨다': 'Enemy pawns, knights and bishops guard all eight squares around them',
  '퀸과 룩은 떨굴 수 없다': 'Queens and rooks cannot be dropped',
  '끊긴 사슬은 점수가 4분의 1': 'Broken chains score a quarter', '응수가 없다': 'No replies', '노려진 칸을 먹으면 곧바로 끊긴다': 'Taking a guarded square breaks the chain at once', '손을 새로 쥔다': 'A fresh hand',
  // ── 불멸의 기보
  '불멸의 대국': 'The Immortal Game', '앤더슨이 룩 둘 · 비숍 · 퀸을 버리고 이겼다': 'Anderssen gave up both rooks, a bishop and his queen, and won',
  '끊겨도 사슬이 이어진다': 'Breaks do not end the chain', '한 사슬에서 끊기지 않고 룩 둘을 먹는다': 'Take two rooks in one chain without a break',
  '오페라 대국': 'The Opera Game', '모피가 오페라 관람석에서 17수 만에 이겼다': 'Morphy won in 17 moves from an opera box',
  '지켜진 킹도 먹는다': 'Take even guarded kings', '대국 첫 수에 외통': 'Mate on the first move of a match',
  '세기의 대국': 'The Game of the Century', '열세 살 피셔의 퀸 희생': "Thirteen-year-old Fischer's queen sacrifice",
  '퀸을 먹고 곧바로 퀸을 또 먹는다': 'Take a queen, then another queen right after',
  '상록의 대국': 'The Evergreen Game', '끝없이 이어지는 공격': 'An attack that never ends',
  '한 사슬에 여덟을 먹는다': 'Take eight in one chain',
  '폰 여덟의 행진': 'March of Eight Pawns', '여덟 폰이 모두 승급한 전설': 'The legend where all eight pawns promoted',
  '한 사슬에서 두 번 승급한다': 'Promote twice in one chain',
  // ── 각인 · 판본 · 기보 · 오프닝 · 단
  '금': 'Gold', '상아': 'Ivory', 
  '흑단': 'Ebony', '유리': 'Glass', '사슬 배수 ×2': 'Chain Mult ×2', '네 번에 한 번 깨진다': 'Shatters one time in four',
  '은': 'Silver', '깃': 'Feather', 
  '은박': 'Foil', '자개': 'Pearl', '무지개': 'Rainbow', '흑요': 'Obsidian', '격언 칸 +1': 'Maxim slot +1',
  '폰의 기보': 'Pawn Study', '나이트의 기보': 'Knight Study', '비숍의 기보': 'Bishop Study', '룩의 기보': 'Rook Study', '퀸의 기보': 'Queen Study',
  '런던': 'London', '시실리안': 'Sicilian', '퀸스 갬빗': "Queen's Gambit", '룩 엔딩': 'Rook Endgame',
  '폰 넷': '4 pawns', '폰 다섯': '5 pawns', '폰 셋': '3 pawns', '나이트 둘': '2 knights', '나이트 셋': '3 knights', '비숍 둘': '2 bishops', '룩 둘': '2 rooks',
  '목표 ×1.25': 'Target ×1.25', '증원 +1': 'Reinforcements +1', '상점 값 +1': 'Shop prices +1', 
  '명인의 상자 다섯 칸이 반': "Master's Chest five-cell chance halved", '명국 첫 조각이 반': 'First fragments halved', '수 −1': 'Moves −1', '대가 목표 ×1.5': 'Grandmaster target ×1.5',
  // 낱말 손질(docs/design-notes/terms.md)
  '빠른 갈아입기': 'Quick Change',
  '되받아치기': 'Counterstrike',
  
  
  '대각선': 'Diagonal',
  
  
  
  
  
  
  
  
  '물건': 'Items',

  // ── 목소리 손질(docs/design-notes/voice.md): 「조건: 효과」 한 줄
  // 시너지(옛 모음) · 버리기
  '기사': 'Rider', '사제': 'Cleric', '시너지': 'Synergy', '버리기': 'Discard', '빼기': 'Remove',
  '파수꾼': 'Sentinel', '오뚝이': 'Second Wind', '왕홀': 'Scepter', '뽑은 대로': 'As Dealt', '미련 없이': 'No Regrets',
  '손과 버리기': 'Hand and Discard', '상점과 시너지': 'Shop and Synergy',
  '판 끝까지 가는 큰 선택 — 정석마다 시너지가 다르다': 'A pick for the whole run — each joseki brings its own synergy',
  '같은 시너지를 2 · 4 · 6개 모으면 효과가 켜진다': 'Collect 2, 4 and 6 of one synergy to switch on its effects',
  '버리기: 든 기물 하나를 버리고 새로 뽑는다. 붉은 구슬만큼 쓸 수 있다': 'Discard: throw the picked piece away and draw a new one. Once per red bead',
  '기사도와 낙타로 기사 시너지가 2개 — 첫 효과가 켜졌다. 4개 · 6개면 더 켜진다': 'Chivalry and the camel make Rider synergy 2 — its first effect is on. More at 4 and 6',
  '이번 대국에 떨굴 수 있는 횟수. 다 쓰면 대국이 끝난다': 'Drops left this match. The match ends when they run out',
  '손에서 하나를 버리고 새로 뽑을 수 있는 횟수': 'Times you can throw away one piece and draw again',
  '기물 하나에 새긴다': 'Engrave one piece', '기물 하나에 깃든다': 'Binds to one piece',
  '체스 기물 하나가 특수 기물로 자란다': 'A chess piece grows into a special piece',
  '아무 기물에 무작위 혼이나 각인': 'A random soul or engraving on a random piece', '아무 기물이 무작위 특수 기물로': 'A random piece becomes a random special piece',
  '폰 › 궁수 · 나이트 › 야간기사 · 낙타 · 비숍 › 대주교 · 룩 › 재상 · 포 · 유령 · 퀸 › 아마존': 'Pawn › archer · knight › nightrider, camel · bishop › archbishop · rook › chancellor, cannon, ghost · queen › amazon',
  '버리기 −1': 'Discards −1', '수 2 · 버리기 1뿐': '2 moves · 1 discard only',
  '지켜지지 않은 킹은 빛난다': 'Unguarded kings glow',
  '나이트 모습으로 가장자리 칸에서 먹을 때, 사슬마다 한 번': 'A knight-form take on an edge square, once per chain',
  '처음 세 먹기는 모습이 바뀌지 않고, 마지막에 먹은 적의 행마도 함께 쓴다': 'The first three takes keep your form, and you also use the move of the last enemy taken',
  '폰 › 나이트 › 비숍 › 룩 › 퀸 › 아마존': 'Pawn › knight › bishop › rook › queen › amazon',
  '주머니가 여섯 이하면 떠나지 않는다': 'It stays if your bag has six or fewer',
  // 격언
  '나이트로 시작: 배수 ×1.5': 'Start with a knight: ×1.5 Mult',
  '폰으로 시작: 값 +40': 'Start with a pawn: +40 Value',
  '모습을 넷 이상 거친 사슬: 배수 ×2': 'Chain with 4+ forms: ×2 Mult',
  '모습이 안 바뀐 사슬: 배수 ×3': 'Chain that never changed form: ×3 Mult',
  '다섯째부터 먹을 때마다 배수 ×1.2': 'Each take from the fifth on: ×1.2 Mult',
  '가장자리 칸에서 먹을 때마다 배수 +2': 'Each take on an edge square: +2 Mult',
  '먹은 적 하나에 상금 +1 · 대국마다 5까지': '+1 Purse per take · up to 5 per match',
  '승급한 사슬은 한 번 끊겨도 이어진다': 'Promoted: one free break',
  '대국마다 한 번, 끊겨도 사슬이 이어진다': 'One free break per match',
  '끊긴 사슬: 배수 +8': 'Broken chain: +8 Mult',
  '끊기지 않은 사슬: 값 +30': 'Unbroken chain: +30 Value',
  '킹을 지키는 적 −1 · 외통 승리: 상금 +6': 'King guard −1 · Mate win: +$6',
  '킹을 지키는 적을 먹으면 배수 +2 · 외통: 배수 ×3': "King's guard: +2 Mult · Mate: ×3 Mult",
  '외통 승리마다 커진다: 배수 ×1.5 · ×2 · ×2.5 …': 'Mult ×1.5 · ×2 … by mates',
  '대국 첫 수: 배수 ×2': "Match's first move: ×2 Mult",
  '대국 마지막 수: 배수 ×3': "Match's last move: ×3 Mult",
  '버리기를 안 쓴 대국: 배수 +4': 'No discards yet this match: +4 Mult',
  '버리기 +1 · 이번 대국에 버린 기물마다 값 +10': 'Discards +1 · +10 Value per discard',
  '주머니에 남은 기물마다 배수 +1': '+1 Mult per piece left in the bag',
  '주머니 기물 여덟 이하: 배수 ×1.5': '8 or fewer pieces in your bag: ×1.5 Mult',
  '막 들어온 증원을 먹으면 값 +40': 'Fresh reinforcement: +40 Value',
  '증원을 두 수 앞까지 본다 · 증원 자리에 떨구면 배수 +4': 'See 2 waves · Drop on one: +4 Mult',
  '상아 각인 기물로 시작: 배수 +5': 'Start with an ivory piece: +5 Mult',
  '이번 판에 쓴 기보마다 배수 +1': '+1 Mult per study used this run',
  '폰이나 나이트로 시작: 배수 +3': 'Pawn/knight start: +3 Mult',
  '판에 적이 여덟 이하: 배수 ×1.5': '≤ 8 enemies: ×1.5 Mult',
  '처음 모습으로 돌아오면 배수 ×2 · 사슬마다 한 번': 'Back to start form: ×2 Mult · once a chain',
  '새 모습이 될 때마다 값 +20': 'Each new form: +20 Value',
  '지키는 적을 먹을 때마다 배수 +2': 'Each guard you take: +2 Mult',
  '증원을 먹을 때마다 배수 +2': 'Each reinforcement taken: +2 Mult',
  '폰 모습으로 둘을 먹으면 곧바로 승급': '2 pawn takes: promote now',
  '가장자리의 나이트: 지키는 적을 한 번 무시한다': 'Knight on the edge: ignore guards once',
  '룩 모습으로 구석에서 먹을 때마다 배수 ×2': 'Rook take in a corner: ×2 Mult',
  // 정석
  '나이트 둘이 야간기사가 된다': 'Two knights become nightriders',
  '룩 하나가 재상이 된다': 'A rook becomes a chancellor',
  '비숍 하나가 대주교가 된다': 'A bishop becomes an archbishop',
  '폰 둘이 궁수가 된다': 'Two pawns become archers',
  'b · g 줄에선 어느 모습이든 세로로 미끄러져 먹는다': 'On the b and g files, any form slides vertically to take',
  '대국마다 금빛 칸 셋 · 그 위 적을 먹으면 배수 ×2': 'Three gold squares per match · take on one: ×2 Mult',
  '문 위 적을 먹으면 다른 문에서 이어 간다 · 대국마다 문 둘': 'Take on a gate: go on from the other gate · two gates per match',
  '끊기는 순간 킹을 뺀 둘레의 적을 모두 먹는다': 'On a break: take every enemy around it but kings',
  '대국 첫 사슬: 배수 ×3 · 시작한 기물은 주머니에서 떠난다': "Match's first chain: ×3 Mult · its piece leaves your bag",
  '주머니 기물이 모두 다른 종류: 목표 절반': 'Every piece in your bag a different kind: half the target',
  '폰으로 시작한 사슬이 승급하면 그 폰은 퀸으로 남는다': 'A pawn that starts a chain and promotes stays a queen',
  '한 사슬이 한 줄에 다섯 칸을 밟으면 곧바로 이긴다': 'A chain that lands on five squares in a line wins at once',
  '가장 많이 모은 시너지는 1 · 3 · 5개에서 켜진다': 'Your biggest synergy turns on at 1, 3 and 5',
  // 혼
  '세 번까지 모습 그대로 · 먹은 적의 행마를 더한다': 'Form holds for 3 takes · adds their moves',
  '막히면 한 번, 처음 모습으로 돌아가 잇는다': 'Once when stuck: back to start form',
  '먹으면 한 단계 위 모습이 된다 · 폰 › 나이트 › 비숍 › 룩 › 퀸 › 아마존': 'Each take: one step up · pawn › knight › bishop › rook › queen › amazon', '먹으면 한 단계 위 모습이 된다': 'Each take: one step up',
  '둘째 먹기 값 +10 · 셋째 +20 · 넷째 +30 …': 'Second take +10 Value · third +20 · fourth +30 …',
  '승급하면 아마존 · 두 줄 먼저 승급': 'Promotes to amazon · two ranks sooner',
  '지키는 적을 무시한다 · 배수 −1': 'Ignores guards · −1 Mult',
  // 적 특성 · 묘수 · 명인
  '사슬의 첫 먹기로는 못 먹는다': "Can't be a chain's first take", '먹으면 둘레의 적도 함께 먹는다': 'Taking it takes the enemies around it too',
  '먹어도 모습이 그대로': 'Taking it keeps your form', '먹으면 대국 뒤 내 주머니에 들어온다': 'Take it and it joins your bag after the match',
  '값이 가장 큰 적 셋: 이번 수엔 못 지킨다': 'Top three enemies: no guarding this move',
  '이번 대국 수 +1': 'Moves +1 this match', '적 폰 넷이 빈칸에 나온다': 'Four enemy pawns step onto empty squares',
  '지켜진 적을 먹으면 곧바로 끊긴다': 'Taking a guarded enemy breaks the chain at once',
  '위 다섯 줄은 안개라 떨굴 수 없다 · 닿은 칸만 걷힌다': 'Fog on the top five ranks: no drops · only squares you reach clear',
  '왼쪽 격언 둘이 잠든다': 'Your two leftmost maxims sleep',
  // 전설
  '지켜진 킹도 먹는다 · 외통하면 판이 다시 차고 사슬이 이어진다': 'Take even guarded kings · a mate refills the board and the chain goes on',
  '퀸 모습으로 먹은 만큼, 사슬 끝에 배수 ×1.5': '×1.5 Mult at chain end for each take as a queen',
  '사슬이 멈추면 한 번, 그 모습으로 다시 떨궈 잇는다': 'Once when the chain stops, drop again in that form and go on',
  '폰으로 시작하면 여섯째 줄에서 승급 · 승급마다 배수 ×3': 'Start with a pawn: promote on the sixth rank · ×3 Mult per promotion',
  // 각인 · 판본
  '사슬이 끝나면 상금 +2': 'When its chain ends: +2 Purse', '값 +30': '+30 Value', '배수 ×1.5': '×1.5 Mult',
  '배수 ×2 · 4번에 1번 깨진다': '×2 Mult · breaks 1 time in 4', '배수 ×2': '×2 Mult', '4번에 1번 깨진다': 'breaks 1 time in 4', '첫 먹기에선 끊기지 않는다': "Can't break on the first take",
  '지켜진 칸에도 떨굴 수 있다': 'Can drop on guarded squares', '값 +50': '+50 Value', '배수 +5': '+5 Mult',
  // 시너지 효과(문턱마다)
  '뛰어 먹으면 값 +20': 'Jumping take: +20 Value',
  '대국마다 한 번, 뛰어 먹으면 지키는 적 무시': 'Once per match, a jumping take ignores its guards',
  '뛰어 먹으면 배수 ×1.5': 'Jumping take: ×1.5 Mult',
  '가로 · 세로로 세 칸 이상 가서 먹으면 배수 +2': 'Straight take after 3+ squares: +2 Mult',
  '가로 · 세로로 지나간 칸마다 값 +10': '+10 Value per square slid straight',
  '가로 · 세로로 먹으면 그 너머 적도 먹는다': 'Straight takes also take the next enemy beyond',
  '대각선으로 먹으면 값 +15': 'Diagonal take: +15 Value', '대각선으로 먹으면 배수 +2': 'Diagonal take: +2 Mult',
  '대각선으로 먹으면 배수 ×1.3': 'Diagonal take: ×1.3 Mult',
  '모습이 바뀔 때마다 배수 +2': 'Each change of form: +2 Mult',
  '거친 모습 셋이면 배수 ×1.5 · 넷이면 ×2 …': 'Three forms in a chain: ×1.5 Mult · four: ×2 …',
  '막히면 한 번, 거친 모든 모습의 행마로 잇는다': 'Once when stuck, goes on with the moves of every form it wore',
  '끊긴 사슬: 값 ×2': 'Broken chain: ×2 Value', '끊길 때마다 배수 ×2': 'Each break: ×2 Mult',
  '승급하거나 퀸 · 아마존을 먹으면 값 +60': 'Promote, or take a queen or amazon: +60 Value',
  '한 줄 먼저 승급한다': 'Promote one rank sooner', '외통하면 판이 다시 찬다 · 대국마다 한 번': 'A mate refills the board · once per match',
  '폰 모습으로 먹을 때마다 배수 +2': 'Each take as a pawn: +2 Mult', '폰으로 시작: 배수 ×3': 'Start with a pawn: ×3 Mult',
  '같은 종류를 잇달아 먹으면 값 +30': 'Same kind again: +30 Value', '판에서 값이 가장 큰 적을 먹으면 배수 +4': 'Take the most valuable enemy on the board: +4 Mult',
  '같은 종류를 잇달아 먹을 때마다 배수 ×1.5': 'Each same-kind take in a row: ×1.5 Mult',
  // 행마(두 문장까지)
  'L자로 뛰어 먹는다. 사이의 기물은 넘는다': 'Jumps in an L to take. Hops over anything between',
  '대각선으로 미끄러져 먹는다': 'Slides diagonally to take', '가로 · 세로로 미끄러져 먹는다': 'Slides straight to take',
  '여덟 방향으로 미끄러져 먹는다': 'Slides any of eight ways to take',
  '둘레 여덟 칸을 지킨다. 지키는 적이 없을 때만 먹힌다': 'Guards the eight squares around. Can be taken only when unguarded',
  '비숍처럼 미끄러지거나 나이트처럼 뛰어 먹는다': 'Takes like a bishop or knight',
  '룩처럼 미끄러지거나 나이트처럼 뛰어 먹는다': 'Slides like a rook or jumps like a knight to take',
  '퀸처럼 미끄러지거나 나이트처럼 뛰어 먹는다': 'Slides like a queen or jumps like a knight to take',
  'L자를 길게, 세 칸 · 한 칸으로 뛰어 먹는다': 'A long L: jumps three and one to take',
  'L자로 뛴다. 같은 방향으로 계속 더 뛸 수 있다': 'Jumps in an L. Can keep jumping the same way',
  '앞의 기물을 넘어, 바로 뒤 칸을 먹는다': 'Hops a piece, takes the square behind',
  '기물 하나를 넘어서 먹는다': 'Jumps one piece to take',
  '두 칸 떨어진 적을 쏜다. 움직이지 않는다': 'Shoots enemies two squares away. Never moves',
  '룩처럼 가로 · 세로로 가며, 기물을 뚫고 지나간다': 'Moves like a rook, through pieces',
  '먹을 수 없는 돌. 포 · 메뚜기는 넘는다': "A stone you can't take. Cannons and grasshoppers hop it",
  '먹으면 상금 +2. 모습은 그대로': 'Take it for +2 Purse. Your form stays',
};

// 틀: 숫자나 이름이 끼는 글. fn(m, tr) — tr로 끼인 말을 다시 옮긴다.
// 쪼개기 전에 먼저 보는 틀(좁은 자리에 맞게 줄인 꼴)
export const PRE = [
  [/^(\d+)개$/, (m) => `${m[1]}`],

  // 시너지 이름 · 칩(「기사 시너지」 · 「기사 +1」 · 「기사 2/4」)
  [/^(기사|성채|사제|변신|희생|왕관|행진|사냥) 시너지$/, (m, tr) => `${tr(m[1])} synergy`],
  [/^(기사|성채|사제|변신|희생|왕관|행진|사냥) \+(\d+)$/, (m, tr) => `${tr(m[1])} +${m[2]}`],
  [/^(기사|성채|사제|변신|희생|왕관|행진|사냥) (\d+)\/(\d+)$/, (m, tr) => `${tr(m[1])} ${m[2]}/${m[3]}`],
  [/^([^\s:\d]+(?: [^\s:\d]+)?): (.+)$/, (m, tr) => `${tr(m[1])}: ${tr(m[2])}`],
  [/^(\d+)관 · (연습|정식|명인) 대국$/, (m) => `Hall ${m[1]} · ${{ 연습: 'Practice', 정식: 'Rated', 명인: 'Master' }[m[2]]}`],
  // 왼쪽 판 제목 「3/8관 · 연습 대국」: 영어는 「Hall 3/8 · Practice」가 판 폭(112)을 넘어 「/8」을 뺀다
  [/^(\d+)\/(\d+)관 · (연습|정식|명인) 대국$/, (m) => `Hall ${m[1]} · ${{ 연습: 'Practice', 정식: 'Rated', 명인: 'Master' }[m[3]]}`],
  [/^(\d+)관 \/ (\d+)관$/, (m) => `Hall ${m[1]} / ${m[2]}`],
  // 판 틀 머리 칸 첫 줄 「3/8관」
  [/^(\d+)\/(\d+)관$/, (m) => `Hall ${m[1]}/${m[2]}`],
];

export const TEMPLATES = [
  [/^(.+) 기보가 적용된다$/, (m, tr) => `Uses the ${tr(m[1]).toLowerCase()} study`],
  [/^(\d+) › (\d+)단계$/, (m) => `Level ${m[1]} › ${m[2]}`],
  [/^(.+)에 (.+)의 혼$/, (m, tr) => `${tr(m[2] + '의 혼')} in ${tr(m[1])}`],
  [/^(폰|나이트|비숍|룩|퀸|킹) 모습$/, (m, tr) => `${tr(m[1])} form`],
  [/^(\d+)관$/, (m) => `Hall ${m[1]}`],
  [/^값 (\d+)$/, (m) => `Value ${m[1]}`],
  [/^(\d+)관 (.+)$/, (m, tr) => `Hall ${m[1]} ${tr(m[2])}`],
  [/^(\d+)단$/, (m) => `Dan ${m[1]}`],
  [/^(\d+)단이 열렸다$/, (m) => `Dan ${m[1]} unlocked`],
  [/^(.+) 대국$/, (m, tr) => `${tr(m[1])} Match`],
  [/^이기면 (\$\d+)$/, (m) => `Win ${m[1]}`],
  [/^(\$\d+) \+ 상자$/, (m) => `${m[1]} + Chest`],
  [/^남은 수 (\d+)$/, (m) => `Moves left ${m[1]}`],
  [/^넘친 목표 ×(\d+)$/, (m) => `Overflow ×${m[1]}`],
  [/^목표 ×(\d+)$/, (m) => `Target ×${m[1]}`],
  [/^다시 진열 (\$\d+)$/, (m) => `Reroll ${m[1]}`],
  [/^빼기 (\$\d+)$/, (m) => `Remove ${m[1]}`],
  [/^팔기 (\$\d+)$/, (m) => `Sell ${m[1]}`],
  [/^(.+)로 (\$\d+)$/, (m, tr) => `To ${tr(m[1])} ${m[2]}`],
  [/^격언 (\d+)\/(\d+)$/, (m) => `Maxims ${m[1]}/${m[2]}`],
  [/^주머니 (\d+)$/, (m) => `Bag ${m[1]}`],
  [/^명인 (.+)$/, (m, tr) => `Master ${tr(m[1])}`],
  [/^목표 ([\d,]+)$/, (m) => `Target ${m[1]}`],
  [/^점수 (.+) \/ 목표 (.+)$/, (m) => `Score ${m[1]} / Target ${m[2]}`],
  [/^상금 (\$\d+)$/, (m) => `Purse ${m[1]}`],
  [/^상금 \+(\d+)$/, (m) => `Purse +${m[1]}`],
  [/^도감 (\d+)칸을 새로 채웠다$/, (m) => `${m[1]} new Almanac entries`],
  [/^오프닝 「(.+)」이 열렸다$/, (m, tr) => `Opening "${tr(m[1])}" unlocked`],
  [/^다음 해금 (.+): (.+) \((\d+)\/(\d+)\)$/, (m, tr) => `Next unlock ${tr(m[1])}: ${tr(m[2])} (${m[3]}/${m[4]})`],
  [/^다음 해금 (.+): (.+) (\d+)\/(\d+)$/, (m, tr) => `Next unlock ${tr(m[1])}: ${tr(m[2])} ${m[3]}/${m[4]}`],
  [/^오늘의 대국 (.+)$/, (m) => `Today's Match ${m[1]}`],
  [/^끝없는 대국 (\d+)관$/, (m) => `Endless · Hall ${m[1]}`],
  [/^끝없는 대국 가장 깊은 곳 (\d+)관$/, (m) => `Deepest endless: Hall ${m[1]}`],
  [/^(.+의 기보) (\d+)$/, (m, tr) => `${tr(m[1])} Lv ${m[2]}`],
  [/^(.+) 한 장$/, (m, tr) => `1 × ${tr(m[1])}`],
  [/^(.+?)(?:으로|로) 승급 \$(\d+)$/, (m, tr) => `Promote to ${tr(m[1])} $${m[2]}`],
  [/^유리 각인 (.+?)[이가] 깨졌다$/, (m, tr) => `Glass ${tr(m[1])} shattered`],
  [/^(.+)에 (.+) 각인$/, (m, tr) => `${tr(m[2])} engraving on ${tr(m[1])}`],
  [/^(.+) 각인$/, (m, tr) => `${tr(m[1])} Engraving`],
  [/^재현: (.+)$/, (m, tr) => `Reenact: ${tr(m[1])}`],
  [/^전설: (.+)$/, (m, tr) => `Legend: ${tr(m[1])}`],
  // 판본 격언 카드의 머릿말 「무지개 격언」
  [/^(은박|자개|무지개|흑요) 격언$/, (m, tr) => `${tr(m[1])} ${tr('격언')}`],
  [/^([■□]) (.+)$/, (m, tr) => `${m[1]} ${tr(m[2])}`],
  [/^(\d+)판$/, (m) => `${m[1]} runs`],
  [/^(폰|나이트|비숍|룩|퀸|킹)!$/, (m, tr) => `${tr(m[1])}!`],
  [/^첫 수업 (\d+)\/(\d+)$/, (m) => `Lesson ${m[1]}/${m[2]}`],
  [/^(기초|대국|판) (\d+)\/(\d+)$/, (m, tr) => `${tr(m[1])} ${m[2]}/${m[3]}`],
  [/^다음에 먹을 적 (\d+)$/, (m) => `Next prey ${m[1]}`],
  [/^지키는 적 (\d+)$/, (m) => `Guards ${m[1]}`],
  [/^배수 \+(.+)$/, (m) => `+${m[1]} Mult`],
  [/^손 (\d+)$/, (m) => `Hand ${m[1]}`],
  [/^버리기 (\d+)$/, (m) => `Discard ${m[1]}`],
  [/^수 (\d+)$/, (m) => `Moves ${m[1]}`],
  [/^격언 칸 (\d+)$/, (m) => `Maxim slots ${m[1]}`],
  [/^(.+) 모습으로 먹을 때마다 값 \+(\d+)$/, (m, tr) => `Each take as a ${tr(m[1]).toLowerCase()}: +${m[2]} Value`],
  [/^배수 \+(\d+)$/, (m) => `+${m[1]} Mult`],
  [/^(.+) (\d+)$/, (m, tr) => `${tr(m[1])} ${m[2]}`],
  // 시너지 이름 + 수(「기사 시너지 3」)
  [/^(.+ 시너지) (\d+)$/, (m, tr) => `${tr(m[1])} ${m[2]}`],
  [/^정석 · (\d+)관$/, (m) => `Joseki · Hall ${m[1]}`],
  [/^\+(폰|나이트|비숍|룩|퀸|대주교|재상|아마존|낙타|야간기사|메뚜기|포|궁수|유령)$/, (m, tr) => `+${tr(m[1])}`],
  [/^(.+)의 혼$/, (m, tr) => `${tr(m[1])} Soul`],
  [/^(.+)의 혼 · (.+)$/, (m, tr) => `${tr(m[1])} Soul · ${m[2]}`],
  [/^묘수 (.+)$/, (m, tr) => `Trick: ${tr(m[1])}`],
  [/^(\S+) › (\S+)$/, (m, tr) => `${tr(m[1])} › ${tr(m[2])}`],
];
