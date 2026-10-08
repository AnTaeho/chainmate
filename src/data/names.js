// 순위 이름(CHM-70): 「~한 ~」 = 형용사 + 동물. 이름은 번호 한 쌍 (a, n)으로 저장하고 보는 사람의 언어로 보여 준다.
// 목록은 뒤에 덧붙이기만 한다 — 번호가 저장되므로 차례를 바꾸거나 빼지 않는다(낱말을 고칠 때도 같은 자리에서 같은 뜻으로).
// 한국어 · 영어는 같은 차례(뜻이 짝). 길이 한도(test/names.test.js): 한국어 「호기심 많은 바다코끼리」 · 영어 「Mischievous Hippopotamus」보다
// 넓은 조합이 나오지 않는다. 놀림 · 비하 · 욕설 · 성적 뜻 · 질병 · 정치 · 종교로 읽힐 낱말, 숫자, 체스 기물 · 이 게임의 기물 이름은 넣지 않는다.
const ADJ = `
졸린|Sleepy
성급한|Hasty
호기심 많은|Curious
장난스러운|Mischievous
느긋한|Relaxed
용감한|Brave
수줍은|Shy
씩씩한|Plucky
명랑한|Cheerful
조용한|Quiet
다정한|Tender
상냥한|Sweet
친절한|Kind
순한|Gentle
똑똑한|Clever
영리한|Smart
똘똘한|Brainy
총명한|Brilliant
슬기로운|Wise
꼼꼼한|Meticulous
신중한|Cautious
조심스러운|Careful
대담한|Bold
재빠른|Swift
날쌘|Nimble
날렵한|Agile
튼튼한|Sturdy
듬직한|Dependable
믿음직한|Reliable
폭신한|Fluffy
보송보송한|Fuzzy
반짝이는|Sparkly
빛나는|Shining
눈부신|Dazzling
환한|Beaming
맑은|Clear
포근한|Cozy
따뜻한|Warm
따스한|Toasty
아늑한|Snug
편안한|Comfy
시원한|Breezy
산뜻한|Crisp
싱그러운|Fresh
한가로운|Leisurely
느릿느릿한|Unhurried
바쁜|Busy
부지런한|Diligent
성실한|Earnest
정직한|Honest
솔직한|Candid
엉뚱한|Quirky
유쾌한|Jolly
즐거운|Merry
행복한|Happy
기쁜|Joyful
반가운|Glad
신난|Excited
들뜬|Giddy
설레는|Thrilled
기운찬|Lively
활기찬|Energetic
힘찬|Vigorous
늠름한|Gallant
당당한|Confident
의젓한|Poised
점잖은|Courteous
예의 바른|Polite
차분한|Calm
침착한|Composed
꾸준한|Steady
고요한|Tranquil
평온한|Peaceful
온화한|Mild
너그러운|Generous
겸손한|Humble
소박한|Modest
귀여운|Cute
깜찍한|Adorable
앙증맞은|Dainty
작은|Small
조그만|Little
커다란|Giant
재치 있는|Witty
눈치 빠른|Perceptive
손재주 좋은|Handy
솜씨 좋은|Skillful
야무진|Deft
발 빠른|Fleet
꿈꾸는|Dreamy
상상하는|Imaginative
공상하는|Musing
생각 많은|Pensive
사려 깊은|Thoughtful
궁금한|Inquisitive
모험하는|Intrepid
겁 없는|Fearless
여행하는|Traveling
떠도는|Wandering
산책하는|Strolling
노래하는|Singing
흥얼대는|Humming
춤추는|Dancing
웃는|Laughing
미소 짓는|Smiling
휘파람 부는|Whistling
하품하는|Yawning
낮잠 자는|Napping
조는|Dozing
나른한|Drowsy
뒹구는|Rolling
기지개 켜는|Stretching
깡충 뛰는|Hopping
달리는|Running
뛰노는|Frolicking
헤엄치는|Swimming
날아가는|Soaring
떠다니는|Drifting
바람 타는|Gliding
두리번대는|Glancing
살금대는|Tiptoeing
숨은|Hidden
깔끔한|Tidy
단정한|Neat
근사한|Dapper
멋진|Splendid
우아한|Elegant
사랑스러운|Lovely
어여쁜|Pretty
끈기 있는|Persistent
참을성 많은|Patient
굳센|Resolute
꿋꿋한|Steadfast
열심인|Keen
책 읽는|Bookish
글 쓰는|Writing
그림 그리는|Painting
차 마시는|Sipping
간식 먹는|Snacking
별 보는|Stargazing
달빛 받은|Moonlit
햇살 받은|Sunlit
눈 덮인|Snowy
이슬 맺힌|Dewy
겨울잠 자는|Hibernating
태평한|Carefree
해맑은|Sunny
진지한|Serious
골똘한|Intent
집중하는|Focused
새침한|Prim
익살스러운|Comical
장난기 많은|Playful
재미있는|Amusing
웃긴|Funny
놀라운|Amazing
신기한|Wondrous
신비로운|Mysterious
비밀스러운|Secretive
조용조용한|Hushed
가뿐한|Sprightly
우렁찬|Booming
수다스러운|Chatty
과묵한|Silent
속삭이는|Whispering
심심한|Bored
배고픈|Hungry
의기양양한|Triumphant
자랑스러운|Proud
뿌듯한|Satisfied
흐뭇한|Pleased
만족한|Content
고마운|Grateful
깜짝 놀란|Surprised
어리둥절한|Puzzled
덤벙대는|Clumsy
허둥대는|Flustered
서두르는|Rushing
일찍 일어난|Early
길 찾는|Wayfinding
보물 찾는|Questing
꽃 가꾸는|Gardening
씨앗 심는|Planting
낚시하는|Fishing
뜨개질하는|Knitting
바느질하는|Sewing
종이 접는|Folding
줄넘기하는|Skipping
자전거 타는|Cycling
썰매 타는|Sledding
미끄럼 타는|Sliding
물장구치는|Splashing
박수 치는|Clapping
손 흔드는|Waving
인사하는|Greeting
응원하는|Cheering
도와주는|Helpful
나누는|Sharing
기다리는|Waiting
약속 지키는|Trusty
한결같은|Loyal
정다운|Amiable
싹싹한|Affable
붙임성 좋은|Sociable
낯가리는|Bashful
기특한|Admirable
훌륭한|Excellent
뛰어난|Outstanding
특별한|Special
평범한|Ordinary
희귀한|Rare
소중한|Precious
운 좋은|Lucky
야심 찬|Ambitious
꿈 많은|Aspiring
희망찬|Hopeful
낙천적인|Optimistic
열정적인|Enthusiastic
창의적인|Creative
독창적인|Inventive
논리적인|Logical
예술적인|Artistic
음악적인|Musical
시적인|Poetic
과학적인|Scientific
모범적인|Exemplary
규칙적인|Orderly
계획적인|Organized
`;
const ANIMAL = `
수달|Otter
고양이|Cat
강아지|Puppy
토끼|Rabbit
다람쥐|Squirrel
햄스터|Hamster
고슴도치|Hedgehog
너구리|Raccoon
여우|Fox
늑대|Wolf
곰|Bear
판다|Panda
코알라|Koala
캥거루|Kangaroo
사슴|Deer
순록|Reindeer
기린|Giraffe
코끼리|Elephant
하마|Hippopotamus
코뿔소|Rhinoceros
얼룩말|Zebra
조랑말|Pony
알파카|Alpaca
양|Sheep
염소|Goat
사자|Lion
호랑이|Tiger
표범|Leopard
치타|Cheetah
퓨마|Puma
재규어|Jaguar
스라소니|Lynx
살쾡이|Wildcat
미어캣|Meerkat
몽구스|Mongoose
담비|Marten
오소리|Badger
두더지|Mole
수리부엉이|Eagle Owl
고래|Whale
돌고래|Dolphin
범고래|Orca
물범|Seal
바다사자|Sea Lion
바다코끼리|Walrus
해달|Sea Otter
펭귄|Penguin
북극곰|Polar Bear
북극여우|Arctic Fox
눈표범|Snow Leopard
거북이|Turtle
바다거북|Sea Turtle
육지거북|Tortoise
개구리|Frog
청개구리|Tree Frog
도롱뇽|Salamander
도마뱀|Lizard
카멜레온|Chameleon
이구아나|Iguana
악어|Crocodile
참새|Sparrow
까치|Magpie
비둘기|Pigeon
부엉이|Owl
독수리|Eagle
송골매|Falcon
황조롱이|Kestrel
갈매기|Seagull
펠리컨|Pelican
두루미|Crane
황새|Stork
백조|Swan
오리|Duck
거위|Goose
공작새|Peafowl
앵무새|Parrot
벌새|Hummingbird
종달새|Lark
꾀꼬리|Oriole
타조|Ostrich
키위|Kiwi
홍학|Flamingo
큰부리새|Toucan
굴뚝새|Wren
직박구리|Bulbul
메추라기|Quail
꿩|Pheasant
왜가리|Heron
백로|Egret
가마우지|Cormorant
알바트로스|Albatross
퍼핀|Puffin
도요새|Sandpiper
물떼새|Plover
논병아리|Grebe
저어새|Spoonbill
따오기|Ibis
파랑새|Bluebird
울새|Robin
되새|Finch
카나리아|Canary
잉꼬|Parakeet
금강앵무|Macaw
청둥오리|Mallard
어치|Jay
찌르레기|Starling
휘파람새|Warbler
나이팅게일|Nightingale
물수리|Osprey
콘도르|Condor
에뮤|Emu
화식조|Cassowary
제비갈매기|Tern
바다제비|Petrel
후투티|Hoopoe
코뿔새|Hornbill
들꿩|Grouse
뇌조|Ptarmigan
문어|Octopus
해파리|Jellyfish
불가사리|Starfish
해마|Seahorse
가오리|Stingray
은어|Sweetfish
참치|Tuna
연어|Salmon
금붕어|Goldfish
잉어|Carp
복어|Pufferfish
날치|Flying Fish
꽃게|Crab
소라게|Hermit Crab
바닷가재|Lobster
가재|Crayfish
조개|Clam
달팽이|Snail
소라|Conch
상어|Shark
고래상어|Whale Shark
개복치|Sunfish
가자미|Flounder
메기|Catfish
장어|Eel
청어|Herring
정어리|Sardine
송어|Trout
망둥어|Goby
나비고기|Butterflyfish
구피|Guppy
네온테트라|Neon Tetra
말미잘|Anemone
가리비|Scallop
앵무조개|Nautilus
크릴|Krill
나비|Butterfly
꿀벌|Honeybee
호박벌|Bumblebee
반딧불이|Firefly
매미|Cicada
귀뚜라미|Cricket
개미|Ant
풍뎅이|Beetle
사슴벌레|Stag Beetle
나방|Moth
애벌레|Caterpillar
호랑나비|Swallowtail
소금쟁이|Water Strider
여치|Katydid
누에|Silkworm
나무늘보|Sloth
개미핥기|Anteater
아르마딜로|Armadillo
카피바라|Capybara
친칠라|Chinchilla
마멋|Marmot
줄다람쥐|Chipmunk
저빌|Gerbil
페럿|Ferret
밍크|Mink
산토끼|Hare
고라니|Water Deer
꽃사슴|Sika Deer
영양|Antelope
가젤|Gazelle
임팔라|Impala
들소|Bison
물소|Buffalo
야크|Yak
무스|Moose
엘크|Elk
큰뿔양|Bighorn
아이벡스|Ibex
스프링복|Springbok
오릭스|Oryx
왈라비|Wallaby
웜뱃|Wombat
쿼카|Quokka
오리너구리|Platypus
가시두더지|Echidna
레서판다|Lesser Panda
사막여우|Fennec Fox
과나코|Guanaco
쿠두|Kudu
호저|Porcupine
천산갑|Pangolin
맥|Tapir
오카피|Okapi
듀공|Dugong
매너티|Manatee
일각고래|Narwhal
벨루가|Beluga
푸들|Poodle
코기|Corgi
비글|Beagle
닥스훈트|Dachshund
치와와|Chihuahua
리트리버|Retriever
허스키|Husky
불도그|Bulldog
퍼그|Pug
콜리|Collie
불곰|Grizzly
반달곰|Moon Bear
오셀롯|Ocelot
서벌|Serval
카라칼|Caracal
울버린|Wolverine
벌꿀오소리|Honey Badger
올챙이|Tadpole
송아지|Calf
망아지|Foal
아기사슴|Fawn
아홀로틀|Axolotl
도마뱀붙이|Gecko
영원|Newt
`;
const pairs = (s) => s.trim().split('\n').map((l) => l.split('|'));
const A = pairs(ADJ), N = pairs(ANIMAL);
export const NAMES = {
  ko: { adj: A.map((p) => p[0]), animal: N.map((p) => p[0]) },
  en: { adj: A.map((p) => p[1]), animal: N.map((p) => p[1]) },
};
export const NAME_COUNT = { a: A.length, n: N.length };

// (a, n) → 보이는 이름. 모르는 번호(더 새 목록에서 온 것)는 빈 글
export function nameText(a, n, lang = 'ko') {
  const L = NAMES[lang] || NAMES.ko;
  const x = L.adj[a], y = L.animal[n];
  return x && y ? `${x} ${y}` : '';
}

// 무작위 이름 하나. rand: () => [0, 1). not: 이 조합은 피한다(다시 짓기가 같은 이름을 주지 않게)
export function randomName(rand = Math.random, not = null) {
  for (let i = 0; ; i++) {
    const a = Math.floor(rand() * NAME_COUNT.a) % NAME_COUNT.a, n = Math.floor(rand() * NAME_COUNT.n) % NAME_COUNT.n;
    if (!not || a !== not.a || n !== not.n || i > 20) return { a, n };
  }
}
